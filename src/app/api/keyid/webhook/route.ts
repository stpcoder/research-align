import crypto from 'node:crypto'
import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

function deterministicThreadId(studyId: string, channel: string, sender: string) {
  const hex = crypto.createHash('sha256').update(`${studyId}|${channel}|${sender.toLowerCase()}`).digest('hex').slice(0, 32)
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`
}

function pick(payload: any, keys: string[]) {
  for (const key of keys) {
    const parts = key.split('.')
    let value = payload
    for (const part of parts) value = value?.[part]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

export async function POST(request: NextRequest) {
  try {
    const studyId = request.nextUrl.searchParams.get('studyId')
    const token = request.nextUrl.searchParams.get('token')
    if (!studyId || !token) return Response.json({ error: 'Missing webhook credentials' }, { status: 401 })
    const payload = await request.json()
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const event = String(pick(payload, ['event','type']) || 'message.received')
    const channel = event.includes('sms') || pick(payload, ['channel','message.channel']) === 'sms' ? 'sms' : 'email'
    const sender = String(pick(payload, ['from','sender','message.from','data.from','data.sender']) || 'unknown')
    const subject = String(pick(payload, ['subject','message.subject','data.subject']) || (channel === 'sms' ? 'SMS' : 'Participant message'))
    const body = String(pick(payload, ['body','text','message.body','message.text','data.body','data.text']) || '')
    const providerMessageId = String(pick(payload, ['messageId','id','message.id','data.id']) || '') || null
    const threadId = deterministicThreadId(studyId, channel, sender)

    const threadInsert = await supabase.from('contact_threads').insert({
      id: threadId,
      study_id: studyId,
      channel,
      participant_address: sender,
      subject,
      status: 'open',
      last_message_at: new Date().toISOString(),
      webhook_token_hash: tokenHash,
    })
    if (threadInsert.error && threadInsert.error.code !== '23505') throw threadInsert.error

    const messageInsert = await supabase.from('contact_messages').insert({
      thread_id: threadId,
      direction: 'inbound',
      body,
      provider_message_id: providerMessageId,
      metadata: { provider: 'keyid', event, raw: payload },
      webhook_token_hash: tokenHash,
    })
    if (messageInsert.error) throw messageInsert.error
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Webhook ingestion failed' }, { status: 400 })
  }
}
