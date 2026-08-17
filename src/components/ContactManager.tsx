'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FormField, ResponseRow, Study } from '@/lib/types'
import { clearParticipantInUrl, navigateResearcher, participantFromUrl, setParticipantInUrl } from '@/lib/researcherNavigation'
import { StatusBadge } from '@/components/admin/AdminUI'

type ContactThread={
  id:string
  study_id:string
  response_id:string|null
  channel:'email'|'sms'|'phone'
  participant_address:string
  requester_name?:string|null
  source?:'participant'|'public_inquiry'
  subject:string|null
  status:'pending'|'open'|'closed'
  last_message_at:string|null
}
type ContactMessage={id:string;thread_id:string;direction:'inbound'|'outbound';body:string;sent_at:string;metadata?:Record<string,any>}
type Assignment={id:string;response_id:string;session_key:string;session_label:string;starts_at:string;ends_at:string;status:'confirmed'|'completed'|'cancelled'|'no_show'}

const fmt=(iso:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))
function fmtSlot(slot:string){const[day,time]=slot.split('T');const[,month,date]=day.split('-').map(Number);return`${month}/${date} ${time}`}
function assignmentLabel(status:Assignment['status']){return status==='confirmed'?'확정':status==='completed'?'완료':status==='no_show'?'불참':'취소'}
function assignmentBadge(status:Assignment['status']){return status==='confirmed'?'confirmed':status==='completed'?'completed':status==='no_show'?'danger':'neutral'}

export default function ContactManager({study}:{study:Study}){
  const[responses,setResponses]=useState<ResponseRow[]>([])
  const[threads,setThreads]=useState<ContactThread[]>([])
  const[messages,setMessages]=useState<ContactMessage[]>([])
  const[assignments,setAssignments]=useState<Assignment[]>([])
  const[selection,setSelection]=useState('')
  const[identityEmail,setIdentityEmail]=useState<string|null>(null)
  const[body,setBody]=useState('')
  const[subject,setSubject]=useState(`${study.title} 안내`)
  const[busy,setBusy]=useState(false)
  const[syncing,setSyncing]=useState(false)
  const[lastSyncedAt,setLastSyncedAt]=useState<string|null>(null)
  const[notice,setNotice]=useState('')
  const[query,setQuery]=useState('')
  const syncLock=useRef(false)

  const nameField=useMemo(()=>study.form_config.fields.find(f=>f.type==='short'&&/이름|name/i.test(f.label))||study.form_config.fields.find(f=>f.type==='short'),[study.form_config.fields])
  const availabilityFields=useMemo(()=>study.form_config.fields.filter(f=>f.type==='availability'),[study.form_config.fields])

  function participantName(row:ResponseRow){
    if(nameField){const value=row.answers?.[nameField.id];if(typeof value==='string'&&value.trim())return value}
    return row.contact_email||row.contact_phone||'참가자'
  }
  function threadsForResponse(row:ResponseRow|null){
    if(!row)return[]
    return threads.filter(t=>t.status!=='closed'&&t.channel==='email'&&(t.response_id===row.id||(!!row.contact_email&&t.participant_address.toLowerCase()===row.contact_email.toLowerCase())))
      .sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1)||new Date(b.last_message_at||0).getTime()-new Date(a.last_message_at||0).getTime())
  }
  function threadForResponse(row:ResponseRow|null){return threadsForResponse(row)[0]||null}
  function assignmentFor(row:ResponseRow,field:FormField){const key=field.sessionKey||field.id;return assignments.find(a=>a.response_id===row.id&&a.session_key===key&&a.status!=='cancelled')||null}
  function availabilityPreview(row:ResponseRow,field:FormField){
    const slots=row.availability?.[field.id]||[]
    if(!slots.length)return'가능 시간 없음'
    const ranks=row.preferences?.[field.id]||{}
    const rankBySlot=new Map<string,number>()
    for(const[rank,slot]of Object.entries(ranks))if(slot)rankBySlot.set(slot,Number(rank))
    const sorted=[...slots].sort((a,b)=>(rankBySlot.get(a)??999)-(rankBySlot.get(b)??999)||a.localeCompare(b))
    const shown=sorted.slice(0,3).map(slot=>{const rank=rankBySlot.get(slot);return`${rank?`${rank}순위 `:''}${fmtSlot(slot)}`})
    return`${shown.join(' · ')}${sorted.length>3?` · +${sorted.length-3}`:''}`
  }

  const inquiryThreads=useMemo(()=>threads.filter(t=>t.source==='public_inquiry'&&!t.response_id&&t.status!=='closed').sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1)||new Date(b.last_message_at||0).getTime()-new Date(a.last_message_at||0).getTime()),[threads])
  const pendingCount=inquiryThreads.filter(t=>t.status==='pending').length+responses.filter(row=>threadsForResponse(row).some(t=>t.status==='pending')).length
  const term=query.trim().toLowerCase()
  const visibleInquiries=useMemo(()=>inquiryThreads.filter(t=>!term||[t.requester_name,t.participant_address].filter(Boolean).join(' ').toLowerCase().includes(term)),[inquiryThreads,term])
  const visibleResponses=useMemo(()=>responses.filter(row=>!term||[participantName(row),row.contact_email,row.contact_phone].filter(Boolean).join(' ').toLowerCase().includes(term)).sort((a,b)=>{const at=threadForResponse(a),bt=threadForResponse(b);const ap=at?.status==='pending'?0:1,bp=bt?.status==='pending'?0:1;return ap-bp||new Date(bt?.last_message_at||0).getTime()-new Date(at?.last_message_at||0).getTime()||participantName(a).localeCompare(participantName(b),'ko')}),[responses,threads,term])

  const explicitThread=selection.startsWith('thread:')?threads.find(t=>t.id===selection.slice(7))||null:null
  const selectedResponseFromKey=selection.startsWith('response:')?responses.find(r=>r.id===selection.slice(9))||null:null
  const selectedResponse=explicitThread?.response_id?responses.find(r=>r.id===explicitThread.response_id)||null:selectedResponseFromKey
  const selectedThread=explicitThread||threadForResponse(selectedResponse)
  const selectedName=explicitThread?explicitThread.requester_name||selectedResponse&&participantName(selectedResponse)||explicitThread.participant_address:selectedResponse?participantName(selectedResponse):''
  const selectedEmail=selectedThread?.participant_address||selectedResponse?.contact_email||''

  function selectResponse(id:string){setSelection(`response:${id}`);setParticipantInUrl(id)}
  function selectInquiry(id:string){setSelection(`thread:${id}`);clearParticipantInUrl()}

  async function invokeClawMail(payload:Record<string,unknown>){
    const{data:{session}}=await supabase.auth.getSession()
    if(!session?.access_token)throw new Error('로그인이 필요합니다.')
    const{data,error}=await supabase.functions.invoke('clawmail',{body:payload,headers:{Authorization:`Bearer ${session.access_token}`}})
    if(error)throw error
    if(data?.error)throw new Error(String(data.error))
    return data as Record<string,any>
  }
  async function load(){
    const[{data:r},{data:t},{data:c},{data:a}]=await Promise.all([
      supabase.from('responses').select('*').eq('study_id',study.id).order('submitted_at'),
      supabase.from('contact_threads').select('*').eq('study_id',study.id).order('last_message_at',{ascending:false,nullsFirst:false}),
      supabase.from('study_contact_channels').select('address').eq('study_id',study.id).eq('provider','clawmail').eq('channel','email').eq('status','active').maybeSingle(),
      supabase.from('assignments').select('id,response_id,session_key,session_label,starts_at,ends_at,status').eq('study_id',study.id).order('starts_at'),
    ])
    const nextResponses=(r||[]) as ResponseRow[],nextThreads=(t||[]) as ContactThread[]
    setResponses(nextResponses);setThreads(nextThreads);setAssignments((a||[]) as Assignment[]);setIdentityEmail(c?.address||null)
    setSelection(current=>{
      const preferred=participantFromUrl()
      if(preferred&&nextResponses.some(row=>row.id===preferred))return`response:${preferred}`
      const valid=current.startsWith('thread:')?nextThreads.some(x=>x.id===current.slice(7)&&x.status!=='closed'):current.startsWith('response:')?nextResponses.some(x=>x.id===current.slice(9)):false
      if(valid)return current
      const pending=nextThreads.find(x=>x.source==='public_inquiry'&&!x.response_id&&x.status==='pending')
      if(pending)return`thread:${pending.id}`
      const participantPending=nextResponses.find(row=>nextThreads.some(t=>t.response_id===row.id&&t.status==='pending'))
      if(participantPending){setParticipantInUrl(participantPending.id);return`response:${participantPending.id}`}
      const inquiry=nextThreads.find(x=>x.source==='public_inquiry'&&!x.response_id&&x.status!=='closed')
      if(inquiry)return`thread:${inquiry.id}`
      if(nextResponses[0]){setParticipantInUrl(nextResponses[0].id);return`response:${nextResponses[0].id}`}
      return''
    })
    return c?.address||null
  }

  useEffect(()=>{let cancelled=false;(async()=>{const address=await load();if(address&&!cancelled)await syncMail(false)})();return()=>{cancelled=true}},[study.id])
  useEffect(()=>{if(!identityEmail)return;const timer=window.setInterval(()=>{void syncMail(false)},60_000);return()=>window.clearInterval(timer)},[study.id,identityEmail])
  useEffect(()=>{if(!selectedThread){setMessages([]);return}supabase.from('contact_messages').select('*').eq('thread_id',selectedThread.id).order('sent_at').then(({data})=>setMessages((data||[]) as ContactMessage[]))},[selection,threads])

  async function connectResearchEmail(){if(busy)return;setBusy(true);setNotice('');try{const data=await invokeClawMail({action:'provision',studyId:study.id});setIdentityEmail(data.email||null);setNotice(data.existing?'연구용 이메일이 연결되어 있습니다.':`연구용 이메일 ${data.email}을 만들었습니다.`);await load();await syncMail(false)}catch(error){setNotice(error instanceof Error?error.message:'연구용 이메일을 연결하지 못했습니다.')}finally{setBusy(false)}}
  async function syncMail(showNotice=true){if(syncLock.current)return;syncLock.current=true;setSyncing(true);try{const data=await invokeClawMail({action:'sync',studyId:study.id});setLastSyncedAt(data.synced_at||new Date().toISOString());if(showNotice)setNotice(data.imported?`새 이메일 ${data.imported}개를 가져왔습니다.`:'새 이메일이 없습니다.');await load()}catch(error){if(showNotice)setNotice(error instanceof Error?error.message:'새 이메일을 확인하지 못했습니다.')}finally{syncLock.current=false;setSyncing(false)}}
  async function ensureEmailThread(row:ResponseRow){const existing=threadForResponse(row);if(existing)return existing;if(!row.contact_email)throw new Error('이 참가자는 이메일 주소를 입력하지 않았습니다.');const{data,error}=await supabase.from('contact_threads').insert({study_id:study.id,response_id:row.id,channel:'email',participant_address:row.contact_email,subject:subject.trim()||`${study.title} 안내`,status:'open',source:'participant',last_message_at:new Date().toISOString()}).select().single();if(error)throw error;return data as ContactThread}
  async function send(){if(!body.trim()||busy)return;if(!identityEmail){setNotice('먼저 연구용 이메일을 연결해주세요.');return}setBusy(true);setNotice('');try{const thread=selectedThread||(selectedResponse?await ensureEmailThread(selectedResponse):null);if(!thread)throw new Error('연락할 문의자 또는 참가자를 선택해주세요.');const data=await invokeClawMail({action:'send',studyId:study.id,threadId:thread.id,subject:thread.subject||subject||`${study.title} 안내`,body:body.trim()});setBody('');setNotice(data.status?`이메일을 보냈습니다. (${data.status})`:'이메일을 보냈습니다.');await load();const{data:m}=await supabase.from('contact_messages').select('*').eq('thread_id',thread.id).order('sent_at');setMessages((m||[]) as ContactMessage[])}catch(error){setNotice(error instanceof Error?error.message:'이메일 발송에 실패했습니다.')}finally{setBusy(false)}}
  async function closeInquiry(){if(!selectedThread||selectedThread.source!=='public_inquiry')return;const{error}=await supabase.from('contact_threads').update({status:'closed'}).eq('id',selectedThread.id);if(error){setNotice(error.message);return}setNotice('문의를 처리 완료로 표시했습니다.');await load()}

  return<div className="contact-workspace"><div className="contact-header"><div><h2>연락</h2><p className="muted">답변이 필요한 문의를 우선 확인하고 참가자 이메일을 관리합니다.</p></div><div className="contact-identity"><span className={`status-dot ${identityEmail?'connected':''}`}/><div><strong>{identityEmail?'연구용 이메일 연결됨':'연구용 이메일 미연결'}</strong><span className="muted small">{identityEmail||'답변을 보내려면 연구용 이메일을 연결하세요.'}</span>{lastSyncedAt&&<span className="muted small">최근 확인 {fmt(lastSyncedAt)}</span>}</div>{identityEmail?<button className="btn secondary small" onClick={()=>syncMail(true)} disabled={syncing}>{syncing?'확인 중…':'새 메일 확인'}</button>:<button className="btn secondary small" onClick={connectResearchEmail} disabled={busy}>{busy?'연결 중…':'연결'}</button>}</div></div>{notice&&<div className="notice">{notice}</div>}
    <div className="contact-browser-new"><aside className="card contact-participants"><input className="contact-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="이름 또는 이메일 검색"/>
      <div className="contact-list-section"><div className="section-head"><h3>문의 대기</h3><span className={`pill ${pendingCount?'contact-pending-pill':''}`}>{pendingCount}</span></div><div className="people contact-people">{visibleInquiries.map(thread=><button type="button" key={thread.id} className={`person contact-person ${selection===`thread:${thread.id}`?'active':''}`} onClick={()=>selectInquiry(thread.id)}><span className="contact-person-title"><strong>{thread.requester_name||thread.participant_address}</strong>{thread.status==='pending'&&<span className="pill contact-pending-pill">대기</span>}</span><span className="muted small">{thread.participant_address}</span><span className="contact-person-meta"><span>{thread.status==='pending'?'답변 필요':'응대 중'}</span>{thread.last_message_at&&<span>{fmt(thread.last_message_at)}</span>}</span></button>)}{!visibleInquiries.length&&<div className="contact-list-empty">매칭되지 않은 대기 문의가 없습니다.</div>}</div></div>
      <div className="contact-list-divider"/><div className="contact-list-section"><div className="section-head"><h3>참가자</h3><span className="muted small">{visibleResponses.length}/{responses.length}명</span></div><div className="people contact-people">{visibleResponses.map(row=>{const thread=threadForResponse(row);return<button type="button" key={row.id} className={`person contact-person ${selection===`response:${row.id}`?'active':''}`} onClick={()=>selectResponse(row.id)}><span className="contact-person-title"><strong>{participantName(row)}</strong>{thread?.status==='pending'&&<span className="pill contact-pending-pill">답변 필요</span>}</span><span className="muted small">{thread?.participant_address||row.contact_email||'이메일 없음'}</span><span className="contact-person-meta"><span>{thread?.status==='pending'?'새 문의':' '}</span>{thread?.last_message_at&&<span>{fmt(thread.last_message_at)}</span>}</span></button>})}{!visibleResponses.length&&<div className="empty compact">검색 결과가 없습니다.</div>}</div></div>
    </aside>
    <section className="card conversation-panel">{!selectedResponse&&!selectedThread?<div className="empty">왼쪽에서 문의자 또는 참가자를 선택하세요.</div>:<><div className="conversation-head"><div><div className="contact-conversation-title"><h2>{selectedName}</h2>{selectedThread?.status==='pending'?<span className="pill contact-pending-pill">답변 필요</span>:selectedThread?.source==='public_inquiry'?<span className="pill">응대 중</span>:null}</div><div className="response-meta">{selectedEmail&&<span>{selectedEmail}</span>}{selectedResponse?.contact_phone&&<span>{selectedResponse.contact_phone}</span>}{selectedThread?.source==='public_inquiry'&&<span>{selectedThread.response_id?'신청자와 연결된 문의':'신청 전 문의'}</span>}</div></div><div className="row">{selectedResponse&&<><button type="button" className="btn secondary small" onClick={()=>navigateResearcher('schedule',selectedResponse.id)}>일정에서 보기</button><button type="button" className="btn ghost small" onClick={()=>navigateResearcher('responses',selectedResponse.id)}>신청 내용</button></>}{selectedThread?.source==='public_inquiry'&&<button className="btn ghost small" onClick={closeInquiry}>처리 완료</button>}</div></div>
      {selectedResponse&&availabilityFields.length>0&&<div className="contact-schedule-context"><strong className="contact-schedule-title">일정</strong><div className="contact-schedule-list">{availabilityFields.map(field=>{const assignment=assignmentFor(selectedResponse,field);return<div className="contact-schedule-row" key={field.id}><strong>{field.sessionLabel||field.label}</strong><span className="contact-schedule-detail">{assignment?fmt(assignment.starts_at):availabilityPreview(selectedResponse,field)}</span>{assignment?<StatusBadge status={assignmentBadge(assignment.status)} label={assignmentLabel(assignment.status)}/>:<StatusBadge status="unassigned" label="미정"/>}</div>})}</div></div>}
      <div className="conversation-messages">{messages.map(message=><div key={message.id} className={`conversation-message ${message.direction}`}><div>{message.body}</div>{message.metadata?.source==='schedule_notification'&&<span className="contact-auto-label">자동 일정 안내</span>}<span>{message.direction==='outbound'?'보냄':'받음'} · {fmt(message.sent_at)}</span></div>)}{!messages.length&&<div className="conversation-empty"><strong>아직 이메일 대화가 없습니다.</strong><span className="muted small">아래에서 첫 이메일을 보내면 이후 답장도 이곳에 이어서 표시됩니다.</span></div>}</div>
      <div className="composer">{!selectedThread&&selectedResponse&&<label>제목<input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="예: 실험 일정 안내"/></label>}<label>메시지<textarea value={body} onChange={e=>setBody(e.target.value)} placeholder={`${selectedName||'문의자'}님에게 보낼 내용을 입력하세요.`}/></label><div className="composer-footer"><span className="muted small">{selectedEmail||'이메일 주소가 없습니다.'}</span><button className="btn" onClick={send} disabled={busy||!body.trim()||!selectedEmail||!identityEmail}>{busy?'보내는 중…':'이메일 보내기'}</button></div></div>
    </>}</section></div>
  </div>
}
