import pino from 'pino'
import { EnvironmentName, Payments } from '@nevermined-io/payments'

const logger = pino({
  transport: { target: 'pino-pretty' },
  level: 'info'
})

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
