import pino from 'pino'
import { EnvironmentName, Payments } from '@nevermined-io/payments'
import IpfsHelper from './ipfs.helper'

const logger = pino({
  transport: { target: 'pino-pretty' },
  level: 'info'
})

export function getLogger() {
  return pino({
    transport: { target: 'pino-pretty' },
    level: 'info'
  })
}

export function getPaymentsInstance(nvmApiKey: string, env: string) {
  logger.info('Initializing NVM Payments Library...')  
  const payments = Payments.getInstance({ 
    nvmApiKey,
    environment: env as EnvironmentName,        
  })

  if (!payments.isLoggedIn) {    
    throw new Error('Failed to login to NVM Payments Library')    
  }
  return payments
}

export async function uploadSpeechFileToIPFS(filePath: string) {
  logger.info(`Uploading file to IPFS: ${filePath}`)
  const hash = await IpfsHelper.add(filePath)
  return `cid://${hash}`    
}
