import { Payments } from '@nevermined-io/payments'
import { getLogger, getPaymentsInstance } from './utils'

const NVM_ENVIRONMENT = process.env.NVM_ENVIRONMENT || 'testing'
const NVM_API_KEY = process.env.NVM_API_KEY
const PLAN_DID = process.env.PLAN_DID!

const logger = getLogger()


let payments: Payments

async function main() {
  logger.info('Registering agent...')
  payments = getPaymentsInstance(NVM_API_KEY!, NVM_ENVIRONMENT)
  logger.info(`Connected to Nevermined Network: ${NVM_ENVIRONMENT}`) 

  // const ENDPOINTS: Endpoint[] = [
  //   { 'POST': `https://one-backend.${NVM_ENVIRONMENT}.nevermined.app/api/v1/agents/(.*)/tasks` },
  //   { 'GET': `https://one-backend.${NVM_ENVIRONMENT}.nevermined.app/api/v1/agents/(.*)/tasks/(.*)` }
  // ]
  // const agentDID = await payments.createService({
  //   planDID: PLAN_DID!,
  //   name: 'Text to Speech AI Agent',
  //   description: 'This agent receives a text in the input and returns an audio file with the text read by a voice.', 
  //   serviceType: 'agent',
  //   serviceChargeType: 'dynamic',
  //   authType: 'none',    
  //   amountOfCredits: 1,
  //   minCreditsToCharge: 1,
  //   maxCreditsToCharge: 10,
  //   endpoints: ENDPOINTS,
  //   openEndpoints: [`https://one-backend.${NVM_ENVIRONMENT}.nevermined.app/api/v1/rest/docs-json`]
  // })

  const agentDID = await payments.createAgent({
    planDID: PLAN_DID,
    name: 'E2E Payments Agent',
    description: 'description',         
    serviceChargeType: 'fixed',
    amountOfCredits: 1,            
    usesAIHub: true,
  })

  logger.info(`Agent DID: ${agentDID.did}`)
}

main().then(() => logger.info('Done!'))
