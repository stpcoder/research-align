import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'

const BASE_URL = (process.env.KEYID_BASE_URL || 'https://keyid.ai').replace(/\/$/, '')
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')

function keyPair(seedHex: string) {
  const seed = Buffer.from(seedHex, 'hex')
  if (seed.length !== 32) throw new Error('Invalid KeyID seed')
  const der = Buffer.concat([PKCS8_PREFIX, seed])
  const privateKey = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })
  const publicKey = crypto.createPublicKey(privateKey)
  return {
    privateKey: seedHex,
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex'),
  }
}

function sign(message: string, privateKeyHex: string) {
  const der = Buffer.concat([PKCS8_PREFIX, Buffer.from(privateKeyHex, 'hex')])
  const key = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })
  return crypto.sign(null, Buffer.from(message), key).toString('hex')
}

async function apiFetch(path: string, init: RequestInit = {}, token?: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })
  const raw = await response.text()
  let data: any
  try { data = raw ? JSON.parse(raw) : {} } catch { data = { error: raw } }
  if (!response.ok) throw new Error(data?.error || `KeyID HTTP ${response.status}`)
  return data
}

async function authenticate(seedHex: string) {
  const kp = keyPair(seedHex)
  const challenge = await apiFetch('/api/auth/challenge', {
    method: 'POST',
    body: JSON.stringify({ pubkey: kp.publicKey }),
  })
  const signature = sign(challenge.nonce, kp.privateKey)
  const verified = await apiFetch('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ pubkey: kp.publicKey, nonce: challenge.nonce, signature }),
  })
  return verified.token as string
}

export function keyIdWebhookTokenHash(webhookToken: string) {
  return crypto.createHash('sha256').update(webhookToken).digest('hex')
}

export async function provisionKeyId(seedHex: string) {
  const kp = keyPair(seedHex)
  const projectKey = process.env.KEYID_PROJECT_KEY?.trim()
  return apiFetch('/api/provision', {
    method: 'POST',
    body: JSON.stringify({
      pubkey: kp.publicKey,
      storageType: 'secrets_manager',
      ...(projectKey ? { projectKey } : {}),
    }),
  })
}

export async function getKeyIdIdentity(seedHex: string) {
  const token = await authenticate(seedHex)
  return apiFetch('/api/identity', {}, token)
}

export async function sendKeyIdEmail(seedHex: string, to: string, subject: string, body: string, threadId?: string) {
  const token = await authenticate(seedHex)
  return apiFetch('/api/send', {
    method: 'POST',
    body: JSON.stringify({
      to,
      subject,
      body,
      displayName: 'StudyForm',
      ...(threadId ? { threadId } : {}),
    }),
  }, token)
}

export async function createKeyIdWebhook(seedHex: string, url: string) {
  const token = await authenticate(seedHex)
  return apiFetch('/api/webhooks', {
    method: 'POST',
    body: JSON.stringify({ url, events: ['message.received'] }),
  }, token)
}
