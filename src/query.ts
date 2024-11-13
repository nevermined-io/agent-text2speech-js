import { AgentExecutionStatus, Payments, sleep, TaskLogMessage } from '@nevermined-io/payments'
import { getLogger, getPaymentsInstance } from './utils'

const NVM_ENVIRONMENT = process.env.NVM_ENVIRONMENT || 'testing'
const SUBSCRIBER_NVM_API_KEY = process.env.SUBSCRIBER_NVM_API_KEY
const PLAN_DID = process.env.PLAN_DID!
const AGENT_DID = process.env.AGENT_DID!

// const SLEEP_INTERVAL = 10_000
// const MAX_RETRIES = 10

const logger = getLogger()

let payments: Payments
let inputParam: string
let accessConfig

function parseArgs(args: string[]) {
  if (args.length < 3) {
    logger.error('Missing required input arguments')
    process.exit(1)
  }
  inputParam = args[2]
}

async function main() {
  parseArgs(process.argv)

  logger.info('Querying AI Agent...')
  payments = getPaymentsInstance(SUBSCRIBER_NVM_API_KEY!, NVM_ENVIRONMENT)
  logger.info(`Connected to Nevermined Network: ${NVM_ENVIRONMENT}`)

  const balanceResult = await payments.getPlanBalance(PLAN_DID)
  logger.info(`Plan balance: ${balanceResult.balance}`)

  if (balanceResult.balance < 1) {
    logger.warn('Insufficient balance to query the AI Agent')
    logger.info('Ordering more credits...')
    await payments.orderPlan(PLAN_DID)
  }

  logger.info(`Querying Agent DID: ${AGENT_DID} with input: ${inputParam}`)
  accessConfig = await payments.getServiceAccessConfig(AGENT_DID)

  logger.info(`Using Proxy: ${accessConfig.neverminedProxyUri}`)
  const aiTask = {
    query: inputParam,
    name: 'text2speech',
    additional_params: [],
    artifacts: [],
  }

  const taskResult = await payments.query.createTask(AGENT_DID, aiTask, accessConfig, taskLog)

  if (taskResult.status !== 201) {
    logger.error(`Failed to create task: ${JSON.stringify(taskResult.data)}`)
    process.exit(1)
  }
  logger.info(`Task [${taskResult.data.task.task_id}] created: ${taskResult.data.task.input_query}`)

  // const taskId = taskResult.data.task.task_id
  // const did = taskResult.data.task.did

  // let resultFound = false
  // let counter = 1
  // while (counter <= MAX_RETRIES) {
  //   logger.info(`Checking task status for task ID [${counter}]: ${taskId}`)
  //   const fullTaskResult = await payments.query.getTaskWithSteps(did, taskId, accessConfig)

  //   if (fullTaskResult.status !== 200) {
  //     logger.error(`Failed to get task: ${fullTaskResult.data}`)
  //     process.exit(1)
  //   }
  //   const fullTask = fullTaskResult.data.task

  //   logger.info(`Task status: ${JSON.stringify(fullTask.task_status)}`)
  //   if (fullTask.task_status === AgentExecutionStatus.Completed) {
  //     logger.info(`Task completed with cost: ${fullTask.cost}`)
  //     logger.info(`  Output: ${fullTask.output}`)
  //     logger.debug(` Returned Headers: ${JSON.stringify(fullTaskResult.headers)}`)
  //     logger.info(JSON.stringify(fullTaskResult.data))
  //     resultFound = true
  //     break
  //   } else if (fullTask.task_status === AgentExecutionStatus.Failed) {
  //     logger.error(`Task failed with message ${fullTask.output}`)
  //     break
  //   }
  //   counter++
  //   await sleep(SLEEP_INTERVAL)
  // }
  await sleep(30_000)
  logger.error('Task not completed in time')
  process.exit(1)

  // if (!resultFound) {
  //   logger.error('Task not completed in time')
  //   process.exit(1)
  // }
}

async function taskLog(data: any) {
  const taskLog: TaskLogMessage = JSON.parse(data)
  if (!taskLog.task_status) {
    logger.info(`LOG: ${taskLog.task_id} :: ${taskLog.message}`)
    return
  }

  if (taskLog.task_status === AgentExecutionStatus.Failed) {
    logger.error(`Task failed with message ${data.output}`)
    process.exit(1)
  } else if (taskLog.task_status === AgentExecutionStatus.Completed) {
    const taskId = taskLog.task_id
    const fullTaskResult = await payments.query.getTaskWithSteps(AGENT_DID, taskId, accessConfig)
    logger.info(`Fetching task ${taskId} with status ${fullTaskResult.status}`)

    if (fullTaskResult.status !== 200) {
      logger.error(`Failed to get task: ${fullTaskResult.data}`)
      process.exit(1)
    }
    const fullTask = fullTaskResult.data.task

    logger.info(`Task status: ${JSON.stringify(fullTask.task_status)}`)
    if (fullTask.task_status === AgentExecutionStatus.Completed) {
      logger.info(`Task completed with cost: ${fullTask.cost}`)
      logger.info(`  ${fullTask.task_id} :: ${fullTask.output}`)
      logger.info(`  Output artifacts :: ${fullTask.output_artifacts}`)
      logger.debug(` Returned Headers: ${JSON.stringify(fullTaskResult.headers)}`)
      process.exit(0)
    } else {
      logger.error(`Task failed with message ${fullTask.output}`)
      process.exit(1)
    }
  }
  return
}

main().then(() => logger.info('Done!'))
