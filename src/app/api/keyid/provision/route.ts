import { NextRequest } from 'next/server'
import { createKeyIdWebhook, getKeyIdIdentity, keyIdWebhookTokenHash, provisionKeyId } from '@/lib/keyid'
import { supabaseAsUser } from '@/lib/supabase'

export const runtime = 'nodejs'

type Body = { studyId?: string }

export async function POST(request: NextRequest) {
  try {
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!bearer) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json()) as Body
    if (!body.studyId) return Response.json({ error: 'studyId is required' }, { status: 400 })

    const db = supabaseAsUser(bearer)
    const { data: userData, error: userError } = await db.auth.getUser(bearer)
    if (userError || !userData.user) return Response.json({ error: 'Invalid session' }, { status: 401 })

    const { data: study, error: studyError } = await db.from('studies').select('id,title').eq('id', body.studyId).single()
    if (studyError || !study) return Response.json({ error: 'Study not found' }, { status: 404 })

    const { data: materialRows, error: materialError } = await db.rpc('ensure_keyid_material', { p_study_id: study.id })
    if (materialError || !materialRows?.[0]) throw materialError || new Error('Could not initialize KeyID material')
    const material = materialRows[0] as { key_seed: string; webhook_token: string }

    await provisionKeyId(material.key_seed).catch((error) => {
      if (!/already|exists|registered/i.test(String(error?.message || error))) throw error
    })

    const identity = await getKeyIdIdentity(material.key_seed)
    const webhookToken = material.webhook_token
    const webhookTokenHash = keyIdWebhookTokenHash(webhookToken)
    const webhookUrl = `${request.nextUrl.origin}/api/keyid/webhook?studyId=${encodeURIComponent(study.id)}&token=${encodeURIComponent(webhookToken)}`

    let webhook: Record<string, unknown> | null = null
    try {
      webhook = await createKeyIdWebhook(material.key_seed, webhookUrl)
    } catch (error) {
      if (!/already|exists|duplicate/i.test(String((error as Error)?.message || error))) throw error
    }

    const config = {
      webhook_token_hash: webhookTokenHash,
      webhook_url: webhookUrl,
      webhook_id: (webhook as any)?.webhookId || (webhook as any)?.id || null,
      updated_at: new Date().toISOString(),
    }

    const channel = {
      study_id: study.id,
      provider: 'keyid',
      channel: 'email',
      address: identity.email || null,
      provider_identity_id: identity.agentId || null,
      status: 'active',
      config,
    }

    const { data: existing } = await db.from('study_contact_channels').select('id').eq('study_id', study.id).eq('provider', 'keyid').eq('channel', 'email').maybeSingle()
    if (existing?.id) await db.from('study_contact_channels').update(channel).eq('id', existing.id)
    else await db.from('study_contact_channels').insert(channel)

    return Response.json({ ...identity, webhookConfigured: true, studyTitle: study.title })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'KeyID provisioning failed'
    return Response.json({
      error: message,
      hint: /Project key required/i.test(message)
        ? 'KeyID 서버가 현재 project key를 요구하고 있습니다. KEYID_PROJECT_KEY를 server-only 환경변수로 설정하면 됩니다.'
        : undefined,
    }, { status: 500 })
  }
}
