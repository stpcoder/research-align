'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ResponseRow, Study } from '@/lib/types'

type ContactThread = {
  id: string
  study_id: string
  response_id: string | null
  channel: 'email' | 'sms' | 'phone'
  participant_address: string
  subject: string | null
  status: string
  last_message_at: string | null
}

type ContactMessage = {
  id: string
  thread_id: string
  direction: 'inbound' | 'outbound'
  body: string
  sent_at: string
}

const fmt = (iso:string) => new Intl.DateTimeFormat('ko-KR', {
  timeZone:'Asia/Seoul', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
}).format(new Date(iso))

export default function ContactManager({study}:{study:Study}) {
  const [responses,setResponses] = useState<ResponseRow[]>([])
  const [threads,setThreads] = useState<ContactThread[]>([])
  const [messages,setMessages] = useState<ContactMessage[]>([])
  const [selectedId,setSelectedId] = useState('')
  const [identityEmail,setIdentityEmail] = useState<string|null>(null)
  const [body,setBody] = useState('')
  const [subject,setSubject] = useState(`${study.title} 안내`)
  const [busy,setBusy] = useState(false)
  const [notice,setNotice] = useState('')

  const nameField = useMemo(
    () => study.form_config.fields.find(f=>f.type==='short' && /이름|name/i.test(f.label))
      || study.form_config.fields.find(f=>f.type==='short'),
    [study.form_config.fields]
  )
  const preferenceField = useMemo(
    () => study.form_config.fields.find(f=>f.type==='radio' && /안내|연락/i.test(f.label)),
    [study.form_config.fields]
  )

  const selected = responses.find(r=>r.id===selectedId) || responses[0] || null

  function participantName(row:ResponseRow) {
    if (nameField) {
      const value=row.answers?.[nameField.id]
      if (typeof value==='string' && value.trim()) return value
    }
    return row.contact_email || row.contact_phone || '참가자'
  }

  function preference(row:ResponseRow) {
    if (!preferenceField) return null
    const value=row.answers?.[preferenceField.id]
    return typeof value==='string' ? value : null
  }

  function threadFor(row:ResponseRow|null) {
    if (!row) return null
    return threads.find(t=>t.channel==='email' && (t.response_id===row.id || (!!row.contact_email && t.participant_address===row.contact_email))) || null
  }

  const selectedThread = threadFor(selected)

  async function load() {
    const [{data:r},{data:t},{data:c}] = await Promise.all([
      supabase.from('responses').select('*').eq('study_id',study.id).order('submitted_at'),
      supabase.from('contact_threads').select('*').eq('study_id',study.id).order('last_message_at',{ascending:false,nullsFirst:false}),
      supabase.from('study_contact_channels').select('address').eq('study_id',study.id).eq('provider','keyid').eq('channel','email').eq('status','active').maybeSingle(),
    ])
    const nextResponses=(r||[]) as ResponseRow[]
    setResponses(nextResponses)
    setThreads((t||[]) as ContactThread[])
    setIdentityEmail(c?.address || null)
    setSelectedId(current=>current || nextResponses[0]?.id || '')
  }

  useEffect(()=>{ load() },[study.id])

  useEffect(()=>{
    const thread=threadFor(selected)
    if (!thread) {
      setMessages([])
      return
    }
    supabase.from('contact_messages').select('*').eq('thread_id',thread.id).order('sent_at').then(({data})=>setMessages((data||[]) as ContactMessage[]))
  },[selectedId,threads])

  async function connectResearchEmail() {
    setBusy(true); setNotice('')
    const {data:{session}}=await supabase.auth.getSession()
    const response=await fetch('/api/keyid/provision',{
      method:'POST',
      headers:{'content-type':'application/json',Authorization:`Bearer ${session?.access_token}`},
      body:JSON.stringify({studyId:study.id}),
    })
    const data=await response.json()
    setBusy(false)
    if (!response.ok) {
      setNotice(data.error || '연구용 이메일을 연결하지 못했습니다.')
      return
    }
    setIdentityEmail(data.email || null)
    await load()
  }

  async function ensureEmailThread(row:ResponseRow) {
    const existing=threadFor(row)
    if (existing) return existing
    if (!row.contact_email) throw new Error('이 참가자는 이메일 주소를 입력하지 않았습니다.')
    const {data,error}=await supabase.from('contact_threads').insert({
      study_id:study.id,
      response_id:row.id,
      channel:'email',
      participant_address:row.contact_email,
      subject:subject.trim() || `${study.title} 안내`,
      status:'open',
      last_message_at:new Date().toISOString(),
    }).select().single()
    if (error) throw error
    const created=data as ContactThread
    setThreads(current=>[created,...current])
    return created
  }

  async function send() {
    if (!selected || !body.trim() || busy) return
    if (!identityEmail) {
      setNotice('먼저 연구용 이메일을 연결해주세요.')
      return
    }
    setBusy(true); setNotice('')
    try {
      const thread=await ensureEmailThread(selected)
      const {data:{session}}=await supabase.auth.getSession()
      const response=await fetch('/api/keyid/send',{
        method:'POST',
        headers:{'content-type':'application/json',Authorization:`Bearer ${session?.access_token}`},
        body:JSON.stringify({
          studyId:study.id,
          threadId:thread.id,
          to:selected.contact_email,
          subject:thread.subject || subject || `${study.title} 안내`,
          body:body.trim(),
        }),
      })
      const data=await response.json()
      if (!response.ok) throw new Error(data.error || '이메일 발송에 실패했습니다.')
      setBody('')
      await load()
      const {data:m}=await supabase.from('contact_messages').select('*').eq('thread_id',thread.id).order('sent_at')
      setMessages((m||[]) as ContactMessage[])
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '이메일 발송에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="contact-workspace">
    <div className="contact-header">
      <div>
        <h2>참가자 연락</h2>
        <p className="muted">참가자를 선택하면 연락처와 이메일 대화 내역을 한 화면에서 확인할 수 있습니다.</p>
      </div>
      <div className="contact-identity">
        <span className={`status-dot ${identityEmail?'connected':''}`}/>
        <div>
          <strong>{identityEmail ? '연구용 이메일 연결됨' : '연구용 이메일 미연결'}</strong>
          <span className="muted small">{identityEmail || '이메일을 보내려면 한 번 연결이 필요합니다.'}</span>
        </div>
        {!identityEmail&&<button className="btn secondary small" onClick={connectResearchEmail} disabled={busy}>{busy?'연결 중…':'연결'}</button>}
      </div>
    </div>

    {notice&&<div className="notice">{notice}</div>}

    <div className="contact-browser-new">
      <aside className="card contact-participants">
        <div className="section-head">
          <h3>참가자</h3>
          <span className="muted small">{responses.length}명</span>
        </div>
        <div className="people contact-people">
          {responses.map(row=>{
            const thread=threadFor(row)
            return <button type="button" key={row.id} className={`person contact-person ${selected?.id===row.id?'active':''}`} onClick={()=>setSelectedId(row.id)}>
              <strong>{participantName(row)}</strong>
              <span className="muted small">{row.contact_email || '이메일 없음'}</span>
              <span className="contact-person-meta">
                {preference(row)&&<span>{preference(row)}</span>}
                {thread?.last_message_at&&<span>{fmt(thread.last_message_at)}</span>}
              </span>
            </button>
          })}
          {!responses.length&&<div className="empty compact">아직 신청자가 없습니다.</div>}
        </div>
      </aside>

      <section className="card conversation-panel">
        {!selected ? <div className="empty">왼쪽에서 참가자를 선택하세요.</div> : <>
          <div className="conversation-head">
            <div>
              <h2>{participantName(selected)}</h2>
              <div className="response-meta">
                {selected.contact_email&&<span>{selected.contact_email}</span>}
                {selected.contact_phone&&<span>{selected.contact_phone}</span>}
                {preference(selected)&&<span>안내 방법: {preference(selected)}</span>}
              </div>
            </div>
            {selectedThread?.subject&&<span className="pill">{selectedThread.subject}</span>}
          </div>

          <div className="conversation-messages">
            {messages.map(message=><div key={message.id} className={`conversation-message ${message.direction}`}>
              <div>{message.body}</div>
              <span>{message.direction==='outbound'?'보냄':'받음'} · {fmt(message.sent_at)}</span>
            </div>)}
            {!messages.length&&<div className="conversation-empty">
              <strong>아직 이메일 대화가 없습니다.</strong>
              <span className="muted small">아래에서 첫 이메일을 보내면 이후 답장도 이곳에 이어서 표시됩니다.</span>
            </div>}
          </div>

          <div className="composer">
            {!selectedThread&&<label>제목<input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="예: 실험 일정 안내"/></label>}
            <label>메시지<textarea value={body} onChange={e=>setBody(e.target.value)} placeholder={`${participantName(selected)}님에게 보낼 내용을 입력하세요.`}/></label>
            <div className="composer-footer">
              <span className="muted small">{selected.contact_email ? selected.contact_email : '이 참가자는 이메일 주소를 입력하지 않았습니다.'}</span>
              <button className="btn" onClick={send} disabled={busy || !body.trim() || !selected.contact_email || !identityEmail}>{busy?'보내는 중…':'이메일 보내기'}</button>
            </div>
          </div>
        </>}
      </section>
    </div>
  </div>
}
