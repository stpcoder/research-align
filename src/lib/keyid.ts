import crypto from 'node:crypto'

const BASE = 'https://keyid.ai'

function keyPair(keySeedHex: string) {
  const seed = Buffer.from(keySeedHex, 'hex')
  if (seed.length !== 32) throw new Error('Invalid KeyID seed')
  const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed])
  const privateKey = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })
  const publicKey = crypto.createPublicKey(privateKey)
  const jwk = publicKey.export({ format: 'jwk' }) as JsonWebKey
  if (!jwk.x) throw new Error('Could not derive KeyID public key')
  return { privateKey, publicHex: Buffer.from(jwk.x, 'base64url').toString('hex') }
}

async function jsonFetch(path: string, init: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
    cache: 'no-store',
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body?.error || body?.message || `KeyID ${r.status}`)
  return body
}

export function keyIdWebhookTokenHash(webhookToken: string) {
  return crypto.createHash('sha256').update(webhookToken).digest('hex')
}

export async function provisionKeyId(keySeedHex: string) {
  const { publicHex } = keyPair(keySeedHex)
  return jsonFetch('/api/provision', {
    method: 'POST',
    body: JSON.stringify({
      pubkey: publicHex,
      storageType: 'secrets_manager',
      sdk: 'studyform-next',
      sdkVersion: '0.3.0',
      runtime: 'node',
      runtimeVersion: process.version,
      platform: process.platform,
    }),
  })
}

export async function keyIdToken(keySeedHex: string) {
  const { privateKey, publicHex } = keyPair(keySeedHex)
  const challenge = await jsonFetch('/api/auth/challenge', {
    method: 'POST',
    body: JSON.stringify({ pubkey: publicHex }),
  })
  const signature = crypto.sign(null, Buffer.from(challenge.nonce), privateKey).toString('hex')
  const verified = await jsonFetch('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ pubkey: publicHex, nonce: challenge.nonce, signature }),
  })
  return verified.token as string
}

export async function getKeyIdIdentity(keySeedHex: string) {
  const token = await keyIdToken(keySeedHex)
  return jsonFetch('/api/identity', { headers: { Authorization: `Bearer ${token}` } })
}

export async function sendKeyIdEmail(keySeedHex: string, to: string, subject: string, body: string, threadId?: string) {
  const token = await keyIdToken(keySeedHex)
  return jsonFetch('/api/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      to,
      subject,
      body,
      ...(threadId ? { threadId } : {}),
      displayName: 'StudyForm Research',
    }),
  })
}

export async function createKeyIdWebhook(keySeedHex: string, url: string) {
  const token = await keyIdToken(keySeedHex)
  return jsonFetch('/api/webhooks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, events: ['message.received', 'sms.received'] }),
  })
}
