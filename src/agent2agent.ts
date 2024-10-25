import { AgentExecutionStatus, generateStepId, Payments, sleep } from '@nevermined-io/payments'
import pino from 'pino'
import { getPaymentsInstance } from './utils'
import { OpenAITools } from './opeai.tools'

const NVM_ENVIRONMENT = process.env.NVM_ENVIRONMENT || 'testing'
const NVM_API_KEY = process.env.NVM_API_KEY
const AGENT_DID = process.env.AGENT_DID!
const OPEN_API_KEY = process.env.OPEN_API_KEY!

const AGENT_YOUTUBE_DID = process.env.AGENT_YOUTUBE || 'did:nv:7d86045034ea8a14c133c487374a175c56a9c6144f6395581435bc7f1dc9e0cc'
const PLAN_YOUTUBE_DID = process.env.PLAN_YOUTUBE_DID || 'did:nv:c0eb8f62687d4d734de446cef07529d093ffc145455afb2c7791fca6026abc48'

const SLEEP_INTERVAL = 7_000
const MAX_RETRIES = 10

const logger = pino({
  transport: { target: 'pino-pretty' },
  level: 'info'
})

const opts = {
  joinAccountRoom: false,
  joinAgentRooms: [AGENT_DID],
  subscribeEventTypes: ['step-updated'],
  getPendingEventsOnSubscribe: false
}

let payments: Payments
let openaiTools: OpenAITools

async function processSteps(data: any) {
  
  const eventData = JSON.parse(data)
  logger.info(`Received event: ${JSON.stringify(eventData)}`)
  const step = await payments.query.getStep(eventData.step_id)  
  logger.info(`Processing Step ${step.task_id} - ${step.step_id} [ ${step.step_status} ]: ${step.input_query}`)

  if (step.step_status != AgentExecutionStatus.Pending) {
    logger.warn(`Step ${step.step_id} is not pending. Skipping...`)
    return
  }
  
  if (step.name === 'init') {
    logger.info(`Setting up steps necessary to resolve agent ...`)
    const transcribeStepId = generateStepId()
    const createResult = await payments.query.createSteps(step.did, step.task_id, { steps: [{
        step_id: transcribeStepId,
        task_id: step.task_id,
        predecessor: step.step_id,
        input_query: step.input_query,        
        name: 'transcribe',
        is_last: false,
        order: 2
      }, {  
        step_id: generateStepId(),              
        task_id: step.task_id,
        predecessor: transcribeStepId,        
        input_query: '',
        name: 'text2speech',
        is_last: true,
        order: 3
    }]})
    createResult.status === 201 ? logger.info('Steps created successfully') : logger.error(`Error creating steps: ${JSON.stringify(createResult.data)}`)      

    const updateResult = await payments.query.updateStep(step.did, {
      ...step,
      step_status: AgentExecutionStatus.Completed,
      output: step.input_query
    })
    updateResult.status === 201 ? logger.info(`Step ${step.name} : ${step.step_id} completed!`) : logger.error(`Error updating step ${step.step_id} - ${JSON.stringify(updateResult.data)}`)

  } else if (step.name === 'transcribe') {
    logger.info(`Transcribing video to text with external agent ...`)

    const balanceResult = await payments.getPlanBalance(PLAN_YOUTUBE_DID)
    logger.info(`Youtube Plan balance: ${balanceResult.balance}`)

    if (balanceResult.balance < 1) {
      logger.warn('Insufficient balance to query the Youtube AI Agent')
      logger.info('Ordering more credits...')
      await payments.orderPlan(PLAN_YOUTUBE_DID)
    }

    const aiTask = {
      query: step.input_query,
      name: "transcribe",
      "additional_params": [],
      "artifacts": []
    }

    logger.info(`Querying Youtube Agent DID: ${AGENT_YOUTUBE_DID} with input: ${step.input_query}`)
    const accessConfig = await payments.getServiceAccessConfig(AGENT_YOUTUBE_DID)

    const taskResult = await payments.query.createTask(AGENT_YOUTUBE_DID, aiTask, accessConfig)

    if (taskResult.status !== 201) {
      logger.error(`Failed to create task: ${taskResult.data}`)
      return
    }
    logger.info(`Task created: ${JSON.stringify(taskResult.data)}`)

    const taskId = taskResult.data.task.task_id
    const did = taskResult.data.task.did

    let fullTask
    let resultFound = false
    let counter = 1
    while (counter <= MAX_RETRIES) {
      logger.info(`Checking Youtube task status for task ID [${counter}]: ${taskId}`)
      const fullTaskResult = await payments.query.getTaskWithSteps(did, taskId, accessConfig)
      
      if (fullTaskResult.status !== 200) {
        logger.error(`Failed to get Youtube task: ${fullTaskResult.data}`)
        process.exit(1)  
      }
      fullTask = fullTaskResult.data.task
      logger.info(`Youtube Task status: ${JSON.stringify(fullTask.task_status)}`)
      if (fullTask.task_status === AgentExecutionStatus.Completed) {
        logger.info(`Youtube Task completed with cost: ${fullTask.cost}`)
        logger.info(`  Output: ${fullTask.output}`)
        logger.info(JSON.stringify(fullTaskResult.data))
        resultFound = true
        break
      } else if (fullTask.task_status === AgentExecutionStatus.Failed) {
        logger.error(`Task failed with message ${fullTask.output}`)        
        break
      }
      counter++
      await sleep(SLEEP_INTERVAL)
    }
    let updateResult
    if (!resultFound) {
      logger.error('Task not completed in time')
      updateResult = await payments.query.updateStep(step.did, {
        ...step,
        step_status: AgentExecutionStatus.Failed,
        is_last: true,
        output: 'Task not completed in time '
      })
    } else {
      updateResult = await payments.query.updateStep(step.did, {
        ...step,
        step_status: AgentExecutionStatus.Completed,
        output: fullTask.output,
        output_additional: fullTask.output_additional,
        output_artifacts: fullTask.output_artifacts,
        cost: fullTask.cost
      })
    }    

    updateResult.status === 201 ? logger.info(`Step ${step.name} : ${step.step_id} completed!`) : logger.error(`Error updating step ${step.step_id} - ${JSON.stringify(updateResult.data)}`)

  } else if (step.name === 'text2speech') {
    logger.info(`Converting text to audio ...`)
    const fileSpeech = await openaiTools.text2speech(step.input_query)
    logger.info(`Speech file generated: ${fileSpeech}`)

    const updateResult = await payments.query.updateStep(step.did, {
      ...step,
      step_status: AgentExecutionStatus.Completed,
      is_last: true,
      output: 'hey baby, we got this!',
      output_additional: '{"result": "success"}',
      output_artifacts: [fileSpeech],
      cost: 5
    })

    updateResult.status === 201 ? logger.info(`Step ${step.name} : ${step.step_id} completed!`) : logger.error(`Error updating step ${step.step_id} - ${JSON.stringify(updateResult.data)}`)

  } else {
    logger.warn(`Step ${step.name} is not recognized. Skipping...`)
    return    
  }


  
}


async function main() {  
  openaiTools = new OpenAITools(OPEN_API_KEY!)
  payments = getPaymentsInstance(NVM_API_KEY!, NVM_ENVIRONMENT)
  logger.info(`Connected to Nevermined Network: ${NVM_ENVIRONMENT}`)  



  await payments.query.subscribe(processSteps, opts)
}




logger.info('Starting Youtube2Speech AI Agent...')

main().then(() => {
  logger.info('Waiting for events!')
}).catch(() => {
  logger.info('Shutting down AI Agent Processor...')
  payments.query.disconnect()
  process.exit(0)
})
