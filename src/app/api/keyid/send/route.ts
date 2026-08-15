import { NextRequest } from 'next/server'
import { sendKeyIdEmail } from '@/lib/keyid'
import { supabaseAsUser } from '@/lib/supabase'

export const runtime = 'nodejs'

type Body = { studyId?: string; threadId?: string; to?: string; subject?: string; body?: string }

export async function POST(request: NextRequest) {
  try {
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!bearer) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const input = (await request.json()) as Body
    if (!input.studyId || !input.threadId || !input.to || !input.body) return Response.json({ error: 'studyId, threadId, to and body are required' }, { status: 400 })

    const db = supabaseAsUser(bearer)
    const { data: userData, error: userError } = await db.auth.getUser(bearer)
    if (userError || !userData.user) return Response.json({ error: 'Invalid session' }, { status: 401 })

    const { data: thread, error: threadError } = await db.from('contact_threads').select('id,study_id,channel,participant_address').eq('id', input.threadId).eq('study_id', input.studyId).single()
    if (threadError || !thread) return Response.json({ error: 'Contact thread not found or not owned by this researcher' }, { status: 404 })
    if (thread.channel !== 'email') return Response.json({ error: 'Outbound SMS is not enabled in this build yet; inbound SMS/webhook storage is supported.' }, { status: 501 })

    const destination = thread.participant_address
    if (!destination || !destination.includes('@')) return Response.json({ error: 'This email thread has no valid participant email address' }, { status: 400 })
    const { data: materialRows, error: materialError } = await db.rpc('ensure_keyid_material', { p_study_id: input.studyId })
    if (materialError || !materialRows?.[0]) throw materialError || new Error('KeyID identity is not initialized')
    const material = materialRows[0] as { key_seed: string }
    const result = await sendKeyIdEmail(material.key_seed, destination, input.subject || 'StudyForm 연구 안내', input.body)
    const providerId = result.messageId || result.id || null
    const { error: insertError } = await db.from('contact_messages').insert({
      thread_id: thread.id,
      direction: 'outbound',
      body: input.body,
      provider_message_id: providerId,
      metadata: { provider: 'keyid', to: destination, subject: input.subject || null },
    })
    if (insertError) throw insertError
    await db.from('contact_threads').update({ last_message_at: new Date().toISOString() }).eq('id', thread.id)
    return Response.json({ ok: true, provider: result })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Message send failed' }, { status: 500 })
  }
}
