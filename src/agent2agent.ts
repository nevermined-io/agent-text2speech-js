import {
  AgentExecutionStatus,
  generateStepId,
  Payments,
  TaskLogMessage,
} from '@nevermined-io/payments'
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

const logger = getLogger()

const opts = {
  joinAccountRoom: false,
  joinAgentRooms: [AGENT_DID],
  subscribeEventTypes: ['step-updated'],
  getPendingEventsOnSubscribe: false,
}

let payments: Payments
let openaiTools: OpenAITools
let accessConfig

async function processSteps(data: any) {
  const eventData = JSON.parse(data)
  logger.info(`Received event: ${JSON.stringify(eventData)}`)
  const step = await payments.query.getStep(eventData.step_id)
  logMessage({
    task_id: step.task_id,
    level: 'info',
    message: `Processing Step ${step.step_id} [ ${step.step_status} ]: ${step.input_query}`,
  })

  if (step.step_status != AgentExecutionStatus.Pending) {
    logger.warn(`${step.task_id} :: Step ${step.step_id} is not pending. Skipping...`)
    return
  }

  if (step.name === 'init') {
    logMessage({
      task_id: step.task_id,
      level: 'info',
      message: `Setting up steps necessary to resolve agent ...`,
    })
    const transcribeStepId = generateStepId()
    const createResult = await payments.query.createSteps(step.did!, step.task_id, {
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
    createResult.success
      ? logMessage({ task_id: step.task_id, level: 'info', message: 'Steps created successfully' })
      : logMessage({
          task_id: step.task_id,
          level: 'error',
          message: `Error creating steps: ${JSON.stringify(createResult.data)}`,
        })

    const updateResult = await payments.query.updateStep(step.did, {
      ...step,
      step_status: AgentExecutionStatus.Completed,
      output: step.input_query,
    })
    updateResult.success
      ? logMessage({
          task_id: step.task_id,
          level: 'info',
          message: `Step ${step.name} : ${step.step_id} completed!`,
        })
      : logMessage({
          task_id: step.task_id,
          level: 'error',
          message: `Error updating step ${step.step_id} - ${JSON.stringify(updateResult.data)}`,
        })
  } else if (step.name === 'transcribe') {
    logMessage({
      task_id: step.task_id,
      level: 'info',
      message: `Transcribing video to text with external agent ...`,
    })

    const balanceResult = await payments.getPlanBalance(PLAN_YOUTUBE_DID)
    logMessage({
      task_id: step.task_id,
      level: 'info',
      message: `Youtube Plan balance: ${balanceResult.balance}`,
    })

    if (balanceResult.balance < 1) {
      logMessage({
        task_id: step.task_id,
        level: 'warning',
        message: `Insufficient balance to query the Youtube AI Agent. Ordering more credits.`,
      })
      await payments.orderPlan(PLAN_YOUTUBE_DID)
    }

    const aiTask = {
      input_query: step.input_query,
      name: 'transcribe',
      input_additional: {},
      input_artifacts: [],
    }

    logMessage({
      task_id: step.task_id,
      level: 'info',
      message: `Querying Youtube Agent DID: ${AGENT_YOUTUBE_DID} with input: ${step.input_query}`,
    })

    const taskResult = await payments.query.createTask(
      AGENT_YOUTUBE_DID,
      aiTask,
      accessConfig,
      async (data) => {
        const taskLog: TaskLogMessage = JSON.parse(data)

        console.log(`Received ws task log: ${JSON.stringify(data)}`)

        if (!taskLog.task_status) {
          logMessage({
            task_id: taskLog.task_id,
            level: 'info',
            message: `LOG: ${taskLog.task_id} :: ${taskLog.message}`,
          })
          return
        }

        return await validateExternalYoutubeSummarizerTask(taskLog.task_id, step)
      },
    )

    if (!taskResult) {
      logMessage({
        task_id: step.task_id,
        task_status: AgentExecutionStatus.Failed,
        level: 'error',
        message: `Failed to create task on Youtube Summarizer external agent: ${taskResult}`,
      })
      // Because we couldnt summarize the Youtube video on the external agent:
      // we UPDATE the Step to FAILED
      await payments.query.updateStep(step.did, {
        ...step,
        step_status: AgentExecutionStatus.Failed,
        is_last: true,
        output: `Error creating task on Youtube Summarizer external agent: ${JSON.stringify(taskResult)}`,
      })
      return
    }

    logMessage({
      task_id: step.task_id,
      level: 'info',
      message: `Task on external agent created [${taskResult.data?.task.task_id}] created: ${taskResult.data?.task.input_query}`,
    })
    logMessage({ task_id: step.task_id, level: 'debug', message: JSON.stringify(taskResult) })

  } else if (step.name === 'text2speech') {
    logMessage({
      task_id: step.task_id,
      level: 'info',
      message: `Converting text to audio ...`,
    })
    const fileSpeech = await openaiTools.text2speech(step.input_query)

    logMessage({
      task_id: step.task_id,
      level: 'info',
      message: `Speech file generated`,
    })
    const cid = await uploadSpeechFileToIPFS(fileSpeech)

    logMessage({
      task_id: step.task_id,
      level: 'info',
      message: `Speech file generated uploaded to IPFS`,
    })

    const updateResult = await payments.query.updateStep(step.did, {
      ...step,
      step_status: AgentExecutionStatus.Completed,
      is_last: true,
      output: `Text converted to audio: ${cid}`,
      output_additional: {result: 'success'},
      output_artifacts: [IpfsHelper.cidToUrl(cid)],
      cost: 20,
    })

    if (updateResult.success)
      logMessage({
        task_id: step.task_id,
        task_status: AgentExecutionStatus.Completed,
        step_id: step.step_id,
        level: 'info',
        message: `Step ${step.name} : ${step.step_id} completed!`,
      })
    else
      logMessage({
        task_id: step.task_id,
        task_status: AgentExecutionStatus.Failed,
        level: 'error',
        message: `Error updating step ${step.step_id} - ${JSON.stringify(updateResult.data)}`,
      })
  } else {
    logMessage({
      task_id: step.task_id,
      level: 'warning',
      message: `Step ${step.name} is not recognized. Skipping...`,
    })
    return
  }
}

async function validateExternalYoutubeSummarizerTask(taskId: string, parentStep: any) {
  const parentTaskId = parentStep.task_id
  const youtubeTaskResult = await payments.query.getTaskWithSteps(
    AGENT_YOUTUBE_DID,
    taskId,
    accessConfig,
  )


  if (youtubeTaskResult.task.task_status === AgentExecutionStatus.Completed) {
    logMessage({
      task_id: parentTaskId,
      level: 'info',
      message: `Youtube summarizer task finished correctly`,
    })
    logMessage({
      task_id: parentTaskId,
      level: 'info',
      message: `Updating parent step ${parentStep.step_id}`,
    })

    await payments.query.updateStep(parentStep.did, {
      ...parentStep,
      step_status: AgentExecutionStatus.Completed,
      output: youtubeTaskResult.task.output,
      output_additional: youtubeTaskResult.task.output_additional,
      output_artifacts: youtubeTaskResult.task.output_artifacts,
      cost: Number(youtubeTaskResult.task.cost) + 5,
    })
  } else {
    logMessage({
      task_id: parentTaskId,
      task_status: AgentExecutionStatus.Failed,
      level: 'error',
      message: `${youtubeTaskResult.task.task_status} - Error creating task on Youtube Summarizer external agent`,
    })

    await payments.query.updateStep(parentStep.did, {
      ...parentStep,
      step_status: AgentExecutionStatus.Failed,
      is_last: true,
      output: 'Task not completed in time. Please try again later.',
    })
  }
}

function logMessage(logMessage: TaskLogMessage) {
  const message = `${logMessage.task_id} :: ${logMessage.message}`
  if (logMessage.level === 'error') logger.error(message)
  else if (logMessage.level === 'warning') logger.warn(message)
  else if (logMessage.level === 'debug') logger.debug(message)
  else logger.info(message)
  payments.query.logTask(logMessage)
}

async function main() {
  openaiTools = new OpenAITools(OPEN_API_KEY!)
  payments = getPaymentsInstance(NVM_API_KEY!, NVM_ENVIRONMENT)
  accessConfig = await payments.query.getServiceAccessConfig(AGENT_YOUTUBE_DID)
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
