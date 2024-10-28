import pino from "pino"

/* eslint-disable @typescript-eslint/no-var-requires */
const IpfsHttpClientLite = require('ipfs-http-client-lite')

const IPFS_GATEWAY = process.env.IPFS_GATEWAY || 'https://ipfs.infura.io:5001'
const IPFS_PROJECT_ID = process.env.IPFS_PROJECT_ID
const IPFS_PROJECT_SECRET = process.env.IPFS_PROJECT_SECRET

const logger = pino({
  transport: { target: 'pino-pretty' },
  level: 'info'
})

export default class IpfsHelper {
  private static authToken: string

  public static async add(content: any): Promise<string> {
    const authToken = this.getAuthToken()
    const ipfs = IpfsHttpClientLite({
      apiUrl: IPFS_GATEWAY,
      ...(authToken && {
        headers: { Authorization: `Basic ${authToken}` }
      })
    })
    const addResult = await ipfs.add(content)
    return addResult[0].hash
  }

  public static async get(cid: string): Promise<string> {
    const url = IPFS_GATEWAY + '/api/v0/cat?arg=' + cid.replace('cid://', '')
    const authToken = this.getAuthToken()
    const options = {
      method: 'POST',
      ...(authToken && {
        headers: { Authorization: `Basic ${authToken}` }
      })
    }

    return fetch(url, options)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            `${res.status}: ${res.statusText} - ${await res.text()}`
          )
        }
        return res.text()
      })
      .catch((err) => {
        throw err
      })
  }

  private static getAuthToken(): string | undefined {
    if (!this.authToken) {
      if (!IPFS_PROJECT_ID || !IPFS_PROJECT_SECRET) {
        logger.warn(`WARNING: Infura IPFS_PROJECT_ID and IPFS_PROJECT_SECRET are not set - disabling ipfs auth`)
        return
      } else {
        this.authToken = Buffer.from(
          `${IPFS_PROJECT_ID}:${IPFS_PROJECT_SECRET}`
        ).toString('base64')
      }
    }
    return this.authToken
  }
}