import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SECRET_KEYS = (() => {
  try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}') as Record<string,string> } catch { return {} }
})()
const ADMIN_KEY = SERVICE_ROLE_KEY || SECRET_KEYS.default || ''
const CLAWMAIL_BASE = 'https://api.clawmail.me/v1'
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

type Json = Record<string, any>

type Material = {
  inbox_id: string
  address: string
  api_token: string
  owner_email?: string | null
  account_id?: string | null
  last_synced_at?: string | null
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'content-type': 'application/json' } })
}

async function parseResponse(response: Response) {
  const raw = await response.text()
  let data: any = {}
  try { data = raw ? JSON.parse(raw) : {} } catch { data = { raw } }
  if (!response.ok) {
    const message = data?.error?.message || data?.error || data?.message || `HTTP ${response.status}`
    throw new Error(String(message))
  }
  return data
}

function userHeaders(jwt: string) {
  return { apikey: ANON_KEY, authorization: `Bearer ${jwt}`, 'content-type': 'application/json' }
}

function adminHeaders() {
  if (!ADMIN_KEY) throw new Error('Supabase server credential is not available')
  return SERVICE_ROLE_KEY
    ? { apikey: ADMIN_KEY, authorization: `Bearer ${ADMIN_KEY}`, 'content-type': 'application/json' }
    : { apikey: ADMIN_KEY, 'content-type': 'application/json' }
}

async function supabaseUser(path: string, jwt: string, init: RequestInit = {}) {
  return parseResponse(await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { ...userHeaders(jwt), ...(init.headers || {}) } }))
}

async function supabaseAdmin(path: string, init: RequestInit = {}) {
  return parseResponse(await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { ...adminHeaders(), ...(init.headers || {}) } }))
}

async function authContext(req: Request, studyId: string) {
  const auth = req.headers.get('authorization') || ''
  const jwt = auth.replace(/^Bearer\s+/i, '')
  if (!jwt) throw new Error('Unauthorized')
  const user = await supabaseUser('/auth/v1/user', jwt)
  if (!user?.id) throw new Error('Invalid session')
  const studies = await supabaseUser(`/rest/v1/studies?id=eq.${encodeURIComponent(studyId)}&select=id,title,slug&limit=1`, jwt)
  const study = Array.isArray(studies) ? studies[0] : null
  if (!study) throw new Error('Study not found or not owned by this researcher')
  return { user, study }
}

async function rpc(name: string, body: Json) {
  return supabaseAdmin(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(body) })
}

async function getMaterial(studyId: string): Promise<Material | null> {
  const rows = await rpc('clawmail_get_material', { p_study_id: studyId })
  return Array.isArray(rows) && rows[0] ? rows[0] as Material : null
}

async function putMaterial(studyId: string, material: Material) {
  await rpc('clawmail_put_material', {
    p_study_id: studyId,
    p_inbox_id: material.inbox_id,
    p_address: material.address,
    p_api_token: material.api_token,
    p_owner_email: material.owner_email || '',
    p_account_id: material.account_id || '',
  })
}

async function touchMaterial(studyId: string, date = new Date().toISOString()) {
  await rpc('clawmail_touch_material', { p_study_id: studyId, p_synced_at: date })
}

async function clawFetch(path: string, token?: string, init: RequestInit = {}) {
  return parseResponse(await fetch(`${CLAWMAIL_BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  }))
}

function safeMailboxName(slug: string) {
  const stem = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'study'
  return `studyform-${stem}-${crypto.randomUUID().slice(0, 6)}`
}

async function ensureChannel(studyId: string, material: Material) {
  const rows = await supabaseAdmin(`/rest/v1/study_contact_channels?study_id=eq.${encodeURIComponent(studyId)}&provider=eq.clawmail&channel=eq.email&select=id&limit=1`)
  const payload = {
    study_id: studyId,
    provider: 'clawmail',
    channel: 'email',
    address: material.address,
    provider_identity_id: material.inbox_id,
    status: 'active',
    config: { polling: true, provider: 'clawmail' },
    updated_at: new Date().toISOString(),
  }
  if (Array.isArray(rows) && rows[0]?.id) {
    await supabaseAdmin(`/rest/v1/study_contact_channels?id=eq.${encodeURIComponent(rows[0].id)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify(payload) })
  } else {
    await supabaseAdmin('/rest/v1/study_contact_channels', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify(payload) })
  }
}

async function provision(studyId: string, user: Json, study: Json) {
  const existing = await getMaterial(studyId)
  if (existing) {
    await ensureChannel(studyId, existing)
    return { email: existing.address, inbox_id: existing.inbox_id, existing: true }
  }
  if (!user.email) throw new Error('Researcher account has no email address')
  const registration = await clawFetch('/register', undefined, { method: 'POST', body: JSON.stringify({ name: safeMailboxName(study.slug || studyId), owner_email: user.email }) })
  const token = registration.api_key ?? registration.token ?? registration.credential?.token
  const inboxId = registration.inbox_id ?? registration.inbox?.id
  const address = registration.email ?? registration.address ?? registration.inbox?.email ?? registration.inbox?.address
  const accountId = registration.account_id ?? registration.account?.id ?? ''
  if (!token || !inboxId || !address) throw new Error('ClawMail registration response did not include email, inbox_id, and token')
  const material: Material = { inbox_id: String(inboxId), address: String(address), api_token: String(token), owner_email: String(user.email), account_id: String(accountId || '') }
  await putMaterial(studyId, material)
  await ensureChannel(studyId, material)
  return { email: material.address, inbox_id: material.inbox_id, existing: false, free_tier: registration.free_tier ?? null }
}

function extractMessages(data: any): any[] {
  if (Array.isArray(data)) return data
  for (const key of ['messages', 'items', 'results']) if (Array.isArray(data?.[key])) return data[key]
  if (Array.isArray(data?.data)) return data.data
  if (data?.data && typeof data.data === 'object') return extractMessages(data.data)
  return []
}

function addressOf(value: any): string {
  const raw = typeof value === 'string' ? value : value?.email ?? value?.address ?? value?.value ?? ''
  const match = String(raw).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return (match?.[0] || String(raw)).trim().toLowerCase()
}

function messageBody(message: any): string {
  const value = message.text ?? message.body ?? message.text_body ?? message.content?.text ?? message.content?.body ?? ''
  return typeof value === 'string' ? value : JSON.stringify(value ?? '')
}
function messageId(message: any): string | null { const value = message.message_id ?? message.id ?? message.messageId; return value ? String(value) : null }
function messageTime(message: any): string { const value = message.received_at ?? message.sent_at ?? message.created_at ?? message.date; const parsed = value ? new Date(value) : new Date(); return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString() }

async function syncInbox(studyId: string) {
  const material = await getMaterial(studyId)
  if (!material) throw new Error('Research email is not connected')
  const inbox = await clawFetch(`/inboxes/${encodeURIComponent(material.inbox_id)}/messages`, material.api_token)
  const messages = extractMessages(inbox)
  const responses = await supabaseAdmin(`/rest/v1/responses?study_id=eq.${encodeURIComponent(studyId)}&select=id,contact_email`)
  const responseByEmail = new Map<string,string>()
  for (const row of Array.isArray(responses) ? responses : []) if (row.contact_email) responseByEmail.set(String(row.contact_email).toLowerCase(), row.id)
  const threadRows = await supabaseAdmin(`/rest/v1/contact_threads?study_id=eq.${encodeURIComponent(studyId)}&channel=eq.email&select=id,response_id,participant_address,subject,last_message_at`)
  const threadByEmail = new Map<string,any>()
  for (const thread of Array.isArray(threadRows) ? threadRows : []) threadByEmail.set(String(thread.participant_address).toLowerCase(), thread)
  let imported = 0
  let skipped = 0
  for (const message of messages) {
    const from = addressOf(message.from ?? message.sender)
    const to = addressOf(message.to ?? message.recipient)
    const direction = String(message.direction || '').toLowerCase()
    const isOutbound = direction === 'outbound' || direction === 'sent' || from === material.address.toLowerCase()
    if (isOutbound || !from || !from.includes('@')) { skipped++; continue }
    const providerId = messageId(message)
    let thread = threadByEmail.get(from)
    if (!thread) {
      const created = await supabaseAdmin('/rest/v1/contact_threads?select=id,response_id,participant_address,subject,last_message_at', {
        method: 'POST', headers: { prefer: 'return=representation' }, body: JSON.stringify({ study_id: studyId, response_id: responseByEmail.get(from) || null, channel: 'email', participant_address: from, subject: String(message.subject || '참가자 이메일'), status: 'open', last_message_at: messageTime(message) }),
      })
      thread = Array.isArray(created) ? created[0] : null
      if (!thread) continue
      threadByEmail.set(from, thread)
    }
    if (providerId) {
      const existing = await supabaseAdmin(`/rest/v1/contact_messages?thread_id=eq.${encodeURIComponent(thread.id)}&provider_message_id=eq.${encodeURIComponent(providerId)}&select=id&limit=1`)
      if (Array.isArray(existing) && existing.length) { skipped++; continue }
    }
    try {
      await supabaseAdmin('/rest/v1/contact_messages', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ thread_id: thread.id, direction: 'inbound', body: messageBody(message), provider_message_id: providerId, sent_at: messageTime(message), metadata: { provider: 'clawmail', subject: message.subject || null, from, to: to || material.address, thread_id: message.thread_id ?? message.threadId ?? null, status: message.status ?? null, safety: message.safety ?? null } }) })
      await supabaseAdmin(`/rest/v1/contact_threads?id=eq.${encodeURIComponent(thread.id)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ last_message_at: messageTime(message), subject: thread.subject || message.subject || '참가자 이메일' }) })
      imported++
    } catch (error) {
      if (/duplicate|23505/i.test(String((error as Error).message))) skipped++
      else throw error
    }
  }
  const syncedAt = new Date().toISOString()
  await touchMaterial(studyId, syncedAt)
  return { imported, skipped, total: messages.length, synced_at: syncedAt, email: material.address }
}

async function sendMessage(studyId: string, threadId: string, body: string, subject?: string) {
  const material = await getMaterial(studyId)
  if (!material) throw new Error('Research email is not connected')
  const threads = await supabaseAdmin(`/rest/v1/contact_threads?id=eq.${encodeURIComponent(threadId)}&study_id=eq.${encodeURIComponent(studyId)}&channel=eq.email&select=id,participant_address,subject&limit=1`)
  const thread = Array.isArray(threads) ? threads[0] : null
  if (!thread) throw new Error('Email conversation was not found')
  const to = addressOf(thread.participant_address)
  if (!to.includes('@')) throw new Error('Participant email address is invalid')
  const prior = await supabaseAdmin(`/rest/v1/contact_messages?thread_id=eq.${encodeURIComponent(thread.id)}&direction=eq.inbound&provider_message_id=not.is.null&select=provider_message_id&order=sent_at.desc&limit=1`)
  const replyTo = Array.isArray(prior) && prior[0]?.provider_message_id ? String(prior[0].provider_message_id) : undefined
  const payload: Json = { to, subject: subject || thread.subject || 'StudyForm 연구 안내', text: body }
  if (replyTo) payload.reply_to = replyTo
  const result = await clawFetch(`/inboxes/${encodeURIComponent(material.inbox_id)}/messages`, material.api_token, { method: 'POST', body: JSON.stringify(payload) })
  const providerId = result.message_id ?? result.id ?? null
  await supabaseAdmin('/rest/v1/contact_messages', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ thread_id: thread.id, direction: 'outbound', body, provider_message_id: providerId, sent_at: result.sent_at || new Date().toISOString(), metadata: { provider: 'clawmail', to, subject: payload.subject, status: result.status ?? null, provider_thread_id: result.thread_id ?? null, safety: result.safety ?? null } }) })
  await supabaseAdmin(`/rest/v1/contact_threads?id=eq.${encodeURIComponent(thread.id)}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ last_message_at: result.sent_at || new Date().toISOString(), subject: payload.subject }) })
  return { message_id: providerId, status: result.status ?? null, sent_at: result.sent_at ?? null, thread_id: result.thread_id ?? null }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const input = await req.json() as Json
    const action = String(input.action || '')
    const studyId = String(input.studyId || '')
    if (!studyId) return json({ error: 'studyId is required' }, 400)
    const { user, study } = await authContext(req, studyId)
    if (action === 'status') {
      const material = await getMaterial(studyId)
      return json({ connected: !!material, email: material?.address || null, inbox_id: material?.inbox_id || null, last_synced_at: material?.last_synced_at || null })
    }
    if (action === 'provision') return json(await provision(studyId, user, study), 201)
    if (action === 'sync') return json(await syncInbox(studyId))
    if (action === 'send') {
      const threadId = String(input.threadId || '')
      const body = String(input.body || '').trim()
      if (!threadId || !body) return json({ error: 'threadId and body are required' }, 400)
      return json(await sendMessage(studyId, threadId, body, input.subject ? String(input.subject) : undefined))
    }
    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ClawMail request failed'
    const status = /Unauthorized|Invalid session/i.test(message) ? 401 : /not found|not owned/i.test(message) ? 404 : 500
    return json({ error: message }, status)
  }
})
