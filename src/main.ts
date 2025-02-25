import { AgentExecutionStatus, Payments, TaskLogMessage } from '@nevermined-io/payments'
import { getLogger, getPaymentsInstance, uploadSpeechFileToIPFS } from './utils'
import { OpenAITools } from './opeai.tools'
import IpfsHelper from './ipfs.helper'

const NVM_ENVIRONMENT = process.env.NVM_ENVIRONMENT || 'testing'
const NVM_API_KEY = process.env.NVM_API_KEY
const AGENT_DID = process.env.AGENT_DID!
const OPEN_API_KEY = process.env.OPEN_API_KEY!

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

  logMessage({
    task_id: step.task_id,
    level: 'info',
    message: `Generating Speech from input query`,
  })
  const fileSpeech = await openaiTools.text2speech(step.input_query!)

  logMessage({
    task_id: step.task_id,
    level: 'info',
    message: `Speech file generated: ${fileSpeech}`,
  })

  const cid = await uploadSpeechFileToIPFS(fileSpeech)
  const assetUrl = IpfsHelper.cidToUrl(cid)

  logMessage({
    task_id: step.task_id,
    level: 'info',
    message: `Speech file uploaded to IPFS: ${cid} - ${assetUrl}`,
  })

  const updateResult = await payments.query.updateStep(step.did!, {
    ...step,
    step_status: AgentExecutionStatus.Completed,
    is_last: true,
    output: 'success',
    output_additional: {},
    output_artifacts: [{ artifact_id: cid, url: assetUrl }],
    cost: 5,
  })
  if (updateResult.success)
    logMessage({
      task_status: AgentExecutionStatus.Completed,
      task_id: step.task_id,
      level: 'info',
      message: `Step ${step.step_id} completed!`,
    })
  else
    logMessage({
      task_status: AgentExecutionStatus.Failed,
      task_id: step.task_id,
      level: 'error',
      message: `Error updating step ${step.step_id} - ${JSON.stringify(updateResult.data)}`,
    })
}

function logMessage(logMessage: TaskLogMessage) {
  if (logMessage.level === 'error') logger.error(logMessage.message)
  else if (logMessage.level === 'warning') logger.warn(logMessage.message)
  else if (logMessage.level === 'debug') logger.debug(logMessage.message)
  else logger.info(logMessage.message)
  payments.query.logTask(logMessage)
}

async function main() {
  openaiTools = new OpenAITools(OPEN_API_KEY!)
  payments = getPaymentsInstance(NVM_API_KEY!, NVM_ENVIRONMENT)
  logger.info(`Connected to Nevermined Network: ${NVM_ENVIRONMENT}`)

  await payments.query.subscribe(processSteps, opts)
}

logger.info('Starting AI Text2Speech Agent...')

main()
  .then(() => {
    logger.info('Waiting for events!')
  })
  .catch(() => {
    logger.info('Shutting down AI Agent Processor...')
    payments.query.disconnect()
    process.exit(0)
  })
