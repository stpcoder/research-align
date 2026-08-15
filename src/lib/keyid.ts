import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import { KeyID } from '@keyid/sdk'

function keyPair(seedHex: string) {
  const seed = Buffer.from(seedHex, 'hex')
  if (seed.length !== 32) throw new Error('Invalid KeyID seed')
  const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed])
  const privateKey = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })
  const publicKey = crypto.createPublicKey(privateKey)
  const jwk = publicKey.export({ format: 'jwk' }) as JsonWebKey
  if (!jwk.x) throw new Error('Could not derive KeyID public key')
  return {
    privateKey: seedHex,
    publicKey: Buffer.from(jwk.x, 'base64url').toString('hex'),
  }
}

function client(seedHex: string) {
  const projectKey = process.env.KEYID_PROJECT_KEY?.trim()
  const options: Record<string, unknown> = { keypair: keyPair(seedHex) }
  if (projectKey) options.projectKey = projectKey
  return new (KeyID as any)(options)
}

export function keyIdWebhookTokenHash(webhookToken: string) {
  return crypto.createHash('sha256').update(webhookToken).digest('hex')
}

export async function provisionKeyId(seedHex: string) {
  return client(seedHex).provision()
}

export async function getKeyIdIdentity(seedHex: string) {
  return client(seedHex).getIdentity()
}

export async function requestKeyIdPhone(seedHex: string) {
  const agent: any = client(seedHex)
  if (typeof agent.requestPhone !== 'function') return null
  return agent.requestPhone()
}

export async function sendKeyIdEmail(seedHex: string, to: string, subject: string, body: string, threadId?: string) {
  return client(seedHex).send(to, subject, body, threadId ? { threadId, displayName: 'StudyForm Research' } : { displayName: 'StudyForm Research' })
}

export async function createKeyIdWebhook(seedHex: string, url: string) {
  const agent: any = client(seedHex)
  try {
    return await agent.createWebhook(url, { events: ['message.received', 'sms.received'] })
  } catch (first) {
    try {
      return await agent.createWebhook(url, ['message.received', 'sms.received'])
    } catch {
      throw first
    }
  }
}
