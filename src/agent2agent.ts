import { AgentExecutionStatus, generateStepId, Payments, sleep } from '@nevermined-io/payments'
import { getLogger, getPaymentsInstance, uploadSpeechFileToIPFS } from './utils'
import { OpenAITools } from './opeai.tools'
import IpfsHelper from './ipfs.helper'

const NVM_ENVIRONMENT = process.env.NVM_ENVIRONMENT || 'testing'
const NVM_API_KEY = process.env.NVM_API_KEY
const AGENT_DID = process.env.AGENT_DID!
const OPEN_API_KEY = process.env.OPEN_API_KEY!

const AGENT_YOUTUBE_DID =
  process.env.AGENT_YOUTUBE_DID ||
  'did:nv:268cc4cb5d9d6531f25b9e750b6aa4d96cc5a514116e3afcf41fe4ca0a27dad0'
const PLAN_YOUTUBE_DID =
  process.env.PLAN_YOUTUBE_DID ||
  'did:nv:f44abbb4f7dfaf752e059e018377f6fa1ba30df7b8e53b627d272682306e660a'

const SLEEP_INTERVAL = 7_000
const MAX_RETRIES = 10

const logger = getLogger()

const opts = {
  joinAccountRoom: false,
  joinAgentRooms: [AGENT_DID],
  subscribeEventTypes: ['step-updated'],
  getPendingEventsOnSubscribe: false,
}

let payments: Payments
let openaiTools: OpenAITools

async function processSteps(data: any) {
  const eventData = JSON.parse(data)
  logger.info(`Received event: ${JSON.stringify(eventData)}`)
  const step = await payments.query.getStep(eventData.step_id)
  logger.info(
    `Processing Step ${step.task_id} - ${step.step_id} [ ${step.step_status} ]: ${step.input_query}`,
  )

  if (step.step_status != AgentExecutionStatus.Pending) {
    logger.warn(`Step ${step.step_id} is not pending. Skipping...`)
    return
  }

  if (step.name === 'init') {
    logger.info(`Setting up steps necessary to resolve agent ...`)
    const transcribeStepId = generateStepId()
    const createResult = await payments.query.createSteps(step.did, step.task_id, {
      steps: [
        {
          step_id: transcribeStepId,
          task_id: step.task_id,
          predecessor: step.step_id,
          name: 'transcribe',
          is_last: false,
        },
        {
          step_id: generateStepId(),
          task_id: step.task_id,
          predecessor: transcribeStepId,
          name: 'text2speech',
          is_last: true,
        },
      ],
    })
    createResult.status === 201
      ? logger.info('Steps created successfully')
      : logger.error(`Error creating steps: ${JSON.stringify(createResult.data)}`)

    const updateResult = await payments.query.updateStep(step.did, {
      ...step,
      step_status: AgentExecutionStatus.Completed,
      output: step.input_query,
    })
    updateResult.status === 201
      ? logger.info(`Step ${step.name} : ${step.step_id} completed!`)
      : logger.error(`Error updating step ${step.step_id} - ${JSON.stringify(updateResult.data)}`)
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
      name: 'transcribe',
      additional_params: [],
      artifacts: [],
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
        output: 'Task not completed in time. Please try again later.',
      })
    } else {
      updateResult = await payments.query.updateStep(step.did, {
        ...step,
        step_status: AgentExecutionStatus.Completed,
        output: fullTask.output,
        output_additional: fullTask.output_additional,
        output_artifacts: fullTask.output_artifacts,
        cost: Number(fullTask.cost) + 5,
      })
    }

    updateResult.status === 201
      ? logger.info(`Step ${step.name} : ${step.step_id} completed!`)
      : logger.error(`Error updating step ${step.step_id} - ${JSON.stringify(updateResult.data)}`)
  } else if (step.name === 'text2speech') {
    logger.info(`Converting text to audio ...`)
    const fileSpeech = await openaiTools.text2speech(step.input_query)
    logger.info(`Speech file generated: ${fileSpeech}`)
    const cid = await uploadSpeechFileToIPFS(fileSpeech)
    logger.info(`Speech file uploaded to IPFS: ${cid}`)

    const updateResult = await payments.query.updateStep(step.did, {
      ...step,
      step_status: AgentExecutionStatus.Completed,
      is_last: true,
      output: `Text converted to audio: ${cid}`,
      output_additional: 'success',
      output_artifacts: [IpfsHelper.cidToUrl(cid)],
      cost: 20,
    })

    updateResult.status === 201
      ? logger.info(`Step ${step.name} : ${step.step_id} completed!`)
      : logger.error(`Error updating step ${step.step_id} - ${JSON.stringify(updateResult.data)}`)
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

main()
  .then(() => {
    logger.info('Waiting for events!')
  })
  .catch(() => {
    logger.info('Shutting down AI Agent Processor...')
    payments.query.disconnect()
    process.exit(0)
  })
