import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SECRET_KEYS = (() => {
  try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}') as Record<string,string> }
  catch { return {} }
})()
const ADMIN_KEY = SERVICE_ROLE_KEY || SECRET_KEYS.default || ''
const CLAWMAIL_BASE = 'https://api.clawmail.me/v1'
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

const admin = createClient(SUPABASE_URL, ADMIN_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

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
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
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

async function clawFetch(path: string, token?: string, init: RequestInit = {}) {
  return parseResponse(await fetch(`${CLAWMAIL_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  }))
}

async function authContext(req: Request, studyId: string) {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jwt) throw new Error('Unauthorized')

  const { data: userData, error: userError } = await admin.auth.getUser(jwt)
  if (userError || !userData.user) throw new Error('Invalid session')

  const { data: study, error: studyError } = await admin
    .from('studies')
    .select('id,title,slug')
    .eq('id', studyId)
    .eq('owner_id', userData.user.id)
    .maybeSingle()
  if (studyError) throw studyError
  if (!study) throw new Error('Study not found or not owned by this researcher')

  return { user: userData.user, study }
}

async function getMaterial(studyId: string): Promise<Material | null> {
  const { data, error } = await admin.rpc('clawmail_get_material', { p_study_id: studyId })
  if (error) throw error
  return Array.isArray(data) && data[0] ? data[0] as Material : null
}

async function putMaterial(studyId: string, material: Material) {
  const { error } = await admin.rpc('clawmail_put_material', {
    p_study_id: studyId,
    p_inbox_id: material.inbox_id,
    p_address: material.address,
    p_api_token: material.api_token,
    p_owner_email: material.owner_email || '',
    p_account_id: material.account_id || '',
  })
  if (error) throw error
}

async function touchMaterial(studyId: string, date = new Date().toISOString()) {
  const { error } = await admin.rpc('clawmail_touch_material', {
    p_study_id: studyId,
    p_synced_at: date,
  })
  if (error) throw error
}

function safeMailboxName(slug: string) {
  const stem = slug.toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 28) || 'study'
  return `studyform-${stem}-${crypto.randomUUID().slice(0, 6)}`
}

async function ensureChannel(studyId: string, material: Material) {
  const { data: existing, error: findError } = await admin
    .from('study_contact_channels')
    .select('id')
    .eq('study_id', studyId)
    .eq('provider', 'clawmail')
    .eq('channel', 'email')
    .maybeSingle()
  if (findError) throw findError

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

  const result = existing?.id
    ? await admin.from('study_contact_channels').update(payload).eq('id', existing.id)
    : await admin.from('study_contact_channels').insert(payload)
  if (result.error) throw result.error
}

async function provision(studyId: string, user: { email?: string | null }, study: { slug?: string | null }) {
  const existing = await getMaterial(studyId)
  if (existing) {
    await ensureChannel(studyId, existing)
    return { email: existing.address, inbox_id: existing.inbox_id, existing: true }
  }
  if (!user.email) throw new Error('Researcher account has no email address')

  const registration = await clawFetch('/register', undefined, {
    method: 'POST',
    body: JSON.stringify({
      name: safeMailboxName(study.slug || studyId),
      owner_email: user.email,
    }),
  })

  const token = registration.api_key ?? registration.token ?? registration.credential?.token
  const inboxId = registration.inbox_id ?? registration.inbox?.id
  const address = registration.email ?? registration.address ?? registration.inbox?.email ?? registration.inbox?.address
  const accountId = registration.account_id ?? registration.account?.id ?? ''
  if (!token || !inboxId || !address) {
    throw new Error('ClawMail registration response did not include email, inbox_id, and token')
  }

  const material: Material = {
    inbox_id: String(inboxId),
    address: String(address),
    api_token: String(token),
    owner_email: user.email,
    account_id: String(accountId || ''),
  }
  await putMaterial(studyId, material)
  await ensureChannel(studyId, material)
  return { email: material.address, inbox_id: material.inbox_id, existing: false }
}

function extractMessages(data: any): any[] {
  if (Array.isArray(data)) return data
  for (const key of ['messages', 'items', 'results']) if (Array.isArray(data?.[key])) return data[key]
  if (Array.isArray(data?.data)) return data.data
  if (data?.data && typeof data.data === 'object') return extractMessages(data.data)
  return []
}

function addressOf(value: any): string {
  if (Array.isArray(value)) return addressOf(value[0])
  const raw = typeof value === 'string' ? value : value?.email ?? value?.address ?? value?.value ?? ''
  const match = String(raw).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return (match?.[0] || String(raw)).trim().toLowerCase()
}

function messageBody(message: any): string {
  const value = message.text ?? message.body ?? message.text_body ?? message.content?.text ?? message.content?.body ?? ''
  return typeof value === 'string' ? value : JSON.stringify(value ?? '')
}
function messageId(message: any): string | null {
  const value = message.message_id ?? message.id ?? message.messageId
  return value ? String(value) : null
}
function messageTime(message: any): string {
  const value = message.received_at ?? message.sent_at ?? message.created_at ?? message.date
  const parsed = value ? new Date(value) : new Date()
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

async function syncInbox(studyId: string) {
  const material = await getMaterial(studyId)
  if (!material) throw new Error('Research email is not connected')

  const inbox = await clawFetch(`/inboxes/${encodeURIComponent(material.inbox_id)}/messages`, material.api_token)
  const messages = extractMessages(inbox)

  const { data: responses, error: responseError } = await admin
    .from('responses').select('id,contact_email').eq('study_id', studyId)
  if (responseError) throw responseError
  const responseByEmail = new Map<string,string>()
  for (const row of responses || []) if (row.contact_email) responseByEmail.set(String(row.contact_email).toLowerCase(), row.id)

  const { data: threads, error: threadError } = await admin
    .from('contact_threads')
    .select('id,response_id,participant_address,requester_name,subject,status,source,last_message_at')
    .eq('study_id', studyId)
    .eq('channel', 'email')
  if (threadError) throw threadError
  const threadByEmail = new Map<string,any>()
  for (const thread of threads || []) threadByEmail.set(String(thread.participant_address).toLowerCase(), thread)

  let imported = 0
  let skipped = 0
  for (const message of messages) {
    const from = addressOf(message.from ?? message.sender)
    const to = addressOf(message.to ?? message.recipient)
    const direction = String(message.direction || '').toLowerCase()
    const isOutbound = direction === 'outbound' || direction === 'sent' || from === material.address.toLowerCase()
    if (isOutbound || !from || !from.includes('@')) { skipped++; continue }

    const responseId = responseByEmail.get(from)
    let thread = threadByEmail.get(from)
    // Accept registered participants and people who already opened an anonymous inquiry thread.
    if (!responseId && !thread) { skipped++; continue }

    const providerId = messageId(message)
    if (!thread) {
      const { data: created, error: createError } = await admin
        .from('contact_threads')
        .insert({
          study_id: studyId,
          response_id: responseId,
          channel: 'email',
          participant_address: from,
          subject: String(message.subject || '참가자 이메일'),
          status: 'pending',
          source: 'participant',
          last_message_at: messageTime(message),
        })
        .select('id,response_id,participant_address,requester_name,subject,status,source,last_message_at')
        .single()
      if (createError) throw createError
      thread = created
      threadByEmail.set(from, thread)
    }

    if (providerId) {
      const { data: existingMessage, error: lookupError } = await admin
        .from('contact_messages').select('id').eq('thread_id', thread.id).eq('provider_message_id', providerId).maybeSingle()
      if (lookupError) throw lookupError
      if (existingMessage) { skipped++; continue }
    }

    const { error: insertError } = await admin.from('contact_messages').insert({
      thread_id: thread.id,
      direction: 'inbound',
      body: messageBody(message),
      provider_message_id: providerId,
      sent_at: messageTime(message),
      metadata: {
        provider: 'clawmail', subject: message.subject || null, from, to: to || material.address,
        provider_thread_id: message.thread_id ?? message.threadId ?? null,
        status: message.status ?? null, safety: message.safety ?? null,
      },
    })
    if (insertError) {
      if (insertError.code === '23505') { skipped++; continue }
      throw insertError
    }

    const { error: updateError } = await admin
      .from('contact_threads')
      .update({ last_message_at: messageTime(message), subject: thread.subject || message.subject || '참가자 이메일', status: 'pending' })
      .eq('id', thread.id)
    if (updateError) throw updateError
    imported++
  }

  const syncedAt = new Date().toISOString()
  await touchMaterial(studyId, syncedAt)
  return { imported, skipped, total: messages.length, synced_at: syncedAt, email: material.address }
}

async function sendMessage(studyId: string, threadId: string, body: string, subject?: string) {
  const material = await getMaterial(studyId)
  if (!material) throw new Error('Research email is not connected')

  const { data: thread, error: threadError } = await admin
    .from('contact_threads').select('id,participant_address,subject').eq('id', threadId).eq('study_id', studyId).eq('channel', 'email').maybeSingle()
  if (threadError) throw threadError
  if (!thread) throw new Error('Email conversation was not found')

  const to = addressOf(thread.participant_address)
  if (!to.includes('@')) throw new Error('Participant email address is invalid')
  const payload = { to, subject: subject || thread.subject || 'StudyForm 연구 안내', text: body }
  const result = await clawFetch(`/inboxes/${encodeURIComponent(material.inbox_id)}/messages`, material.api_token, {
    method: 'POST', body: JSON.stringify(payload),
  })

  const providerId = result.message_id ?? result.id ?? null
  const sentAt = result.sent_at || new Date().toISOString()
  const { error: messageError } = await admin.from('contact_messages').insert({
    thread_id: thread.id,
    direction: 'outbound',
    body,
    provider_message_id: providerId,
    sent_at: sentAt,
    metadata: {
      provider: 'clawmail', to, subject: payload.subject, status: result.status ?? null,
      provider_thread_id: result.thread_id ?? null, safety: result.safety ?? null,
    },
  })
  if (messageError) throw messageError

  const { error: updateError } = await admin
    .from('contact_threads')
    .update({ last_message_at: sentAt, subject: payload.subject, status: 'open' })
    .eq('id', thread.id)
  if (updateError) throw updateError

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
