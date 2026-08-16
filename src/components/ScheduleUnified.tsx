'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FormField, ResponseRow, Study } from '@/lib/types'
import { AdminListItem, AdminPageHeader, AdminPanelHeader, AdminSplitView, AdminSurface, StatusBadge } from '@/components/admin/AdminUI'

type Assignment={
  id:string
  study_id:string
  response_id:string
  session_key:string
  session_label:string
  starts_at:string
  ends_at:string
  status:'confirmed'|'completed'|'cancelled'|'no_show'
  scheduling_source?:'participant_selection'|'admin_agreed'
  agreement_confirmed_at?:string|null
  study?:{title:string}|null
}
type NotificationRow={id:string;assignment_id:string|null;status:'pending'|'sent'|'failed'|'skipped';destination:string;error:string|null;created_at:string;sent_at:string|null;kind?:string;metadata?:Record<string,any>}
type OtherSelection={name:string;rank:number}
type NoticeResult={status?:string;event?:string;already_sent?:boolean;error?:string}
type PersonFilter='all'|'unscheduled'|'partial'|'scheduled'|'done'

const fmtDateTime=(iso:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))
const fmtDay=(day:string)=>new Date(`${day}T00:00:00+09:00`).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric',weekday:'short'})
function kstSlot(iso:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso));const get=(t:string)=>parts.find(p=>p.type===t)?.value||'';return`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`}
function buildTimes(field:FormField){const[start,end]=(field.hours||'10:00-18:00').split('-');const[sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number);const step=Math.max(5,field.stepMinutes||30);const result:string[]=[];for(let minute=sh*60+sm;minute<eh*60+em;minute+=step)result.push(`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`);return result}
function timeText(minutes:number){return`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`}
function fieldAllowsSlot(field:FormField,slot:string){const blocked=new Set(field.blockedSlots||[]);if(!blocked.size)return true;const[day,time]=slot.split('T');const[h,m]=time.split(':').map(Number);const step=Math.max(5,field.stepMinutes||30);const duration=field.duration||60;for(let minute=h*60+m;minute<h*60+m+duration;minute+=step)if(blocked.has(`${day}T${timeText(minute)}`))return false;return true}
const blocksTime=(a:Assignment)=>a.status!=='cancelled'
const overlap=(start:number,end:number,a:Assignment)=>start<new Date(a.ends_at).getTime()&&end>new Date(a.starts_at).getTime()

export default function ScheduleUnified({study}:{study:Study}){
  const[responses,setResponses]=useState<ResponseRow[]>([])
  const[allAssignments,setAllAssignments]=useState<Assignment[]>([])
  const[notifications,setNotifications]=useState<NotificationRow[]>([])
  const[selectedId,setSelectedId]=useState('')
  const[activeSessionKey,setActiveSessionKey]=useState('')
  const[pendingSlot,setPendingSlot]=useState<string|null>(null)
  const[pendingManual,setPendingManual]=useState(false)
  const[directMode,setDirectMode]=useState(false)
  const[busy,setBusy]=useState(false)
  const[emailNotice,setEmailNotice]=useState<{text:string;ok:boolean}|null>(null)
  const[query,setQuery]=useState('')
  const[personFilter,setPersonFilter]=useState<PersonFilter>('all')

  const rawFields=useMemo(()=>study.form_config.fields.filter(f=>f.type==='availability'),[study.form_config.fields])
  const configuredOrder=(study.scheduling_config?.sessionOrder as string[]|undefined)||[]
  const sessionKey=(field:FormField)=>field.sessionKey||field.id
  const fields=useMemo(()=>{const ordered=configuredOrder.map(key=>rawFields.find(field=>sessionKey(field)===key)).filter(Boolean) as FormField[];const remaining=rawFields.filter(field=>!configuredOrder.includes(sessionKey(field)));return[...ordered,...remaining]},[rawFields,configuredOrder.join('|')])
  const nameField=useMemo(()=>study.form_config.fields.find(f=>f.type==='short'&&/이름|name/i.test(f.label))||study.form_config.fields.find(f=>f.type==='short'),[study.form_config.fields])
  const assignments=useMemo(()=>allAssignments.filter(a=>a.study_id===study.id),[allAssignments,study.id])
  const selected=responses.find(row=>row.id===selectedId)||responses[0]||null
  const activeField=fields.find(field=>sessionKey(field)===activeSessionKey)||fields[0]||null
  const maxPerDay=Number(study.scheduling_config?.maxSessionsPerDay||0)

  function participantName(row:ResponseRow){if(nameField){const value=row.answers?.[nameField.id];if(typeof value==='string'&&value.trim())return value}return row.contact_email||row.contact_phone||'참가자'}
  function participantNameById(id:string){const row=responses.find(item=>item.id===id);return row?participantName(row):'참가자'}
  function assignmentFor(row:ResponseRow,field:FormField){return assignments.find(a=>a.response_id===row.id&&a.session_key===sessionKey(field)&&a.status!=='cancelled')||null}
  function latestNotification(a:Assignment|null){return a?notifications.find(n=>n.assignment_id===a.id&&(!n.kind||n.kind==='schedule_confirmation'))||null:null}

  async function load(){
    const[{data:r},{data:a},{data:n}]=await Promise.all([
      supabase.from('responses').select('*').eq('study_id',study.id).order('submitted_at'),
      supabase.from('assignments').select('*,study:studies(title)').order('starts_at'),
      supabase.from('notifications').select('*').eq('study_id',study.id).eq('channel','email').order('created_at',{ascending:false}),
    ])
    const nextResponses=(r||[]) as ResponseRow[]
    setResponses(nextResponses);setAllAssignments((a||[]) as unknown as Assignment[]);setNotifications((n||[]) as NotificationRow[])
    setSelectedId(current=>current&&nextResponses.some(row=>row.id===current)?current:nextResponses[0]?.id||'')
    setActiveSessionKey(current=>current&&fields.some(field=>sessionKey(field)===current)?current:fields[0]?sessionKey(fields[0]):'')
  }
  useEffect(()=>{load()},[study.id])
  useEffect(()=>{setPendingSlot(null);setPendingManual(false);setDirectMode(false)},[selectedId,activeSessionKey])
  useEffect(()=>{if(!emailNotice)return;const timer=window.setTimeout(()=>setEmailNotice(null),5000);return()=>window.clearTimeout(timer)},[emailNotice])

  async function sendScheduleNotification(assignmentId:string,mode:'schedule'|'cancelled'='schedule'){
    const{data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error('로그인이 필요합니다.')
    const{data,error}=await supabase.functions.invoke('schedule-notify',{body:{studyId:study.id,assignmentId,mode},headers:{Authorization:`Bearer ${session.access_token}`}})
    if(error)throw error
    return data as NoticeResult
  }
  function notificationMessage(result:NoticeResult){
    if(result.status==='sent'){
      if(result.already_sent)return{ok:true,text:'같은 내용의 안내 메일이 이미 전송되어 있습니다.'}
      if(result.event==='cancelled')return{ok:true,text:'일정 취소 안내 메일을 보냈습니다.'}
      if(result.event==='changed')return{ok:true,text:'일정 변경 안내 메일을 보냈습니다.'}
      return{ok:true,text:'일정 확정 안내 메일을 보냈습니다.'}
    }
    if(result.status==='skipped')return{ok:false,text:'일정 상태는 반영했지만 신청 이메일이 없어 안내 메일은 보내지 않았습니다.'}
    return{ok:false,text:`일정 상태는 반영했지만 안내 메일을 보내지 못했습니다.${result.error?` ${result.error}`:''}`}
  }

  function firstUnscheduledField(row:ResponseRow){return fields.find(field=>!assignmentFor(row,field))||fields[0]||null}
  function selectParticipant(id:string){const row=responses.find(item=>item.id===id);setSelectedId(id);setPendingSlot(null);setPendingManual(false);setDirectMode(false);const next=row?firstUnscheduledField(row):null;if(next)setActiveSessionKey(sessionKey(next))}

  const dates=useMemo(()=>{if(!activeField)return[];if(activeField.dates?.length)return activeField.dates;const set=new Set<string>();for(const response of responses)for(const slot of response.availability?.[activeField.id]||[])set.add(slot.split('T')[0]);return[...set].sort()},[activeField,responses])
  const times=useMemo(()=>activeField?buildTimes(activeField):[],[activeField])
  function rankFor(row:ResponseRow,field:FormField,slot:string){const pref=row.preferences?.[field.id]||{};const found=Object.entries(pref).find(([,value])=>value===slot);return found?Number(found[0]):0}
  function otherSelections(field:FormField,slot:string,rowId:string):OtherSelection[]{return responses.filter(row=>row.id!==rowId&&(row.availability?.[field.id]||[]).includes(slot)).map(row=>({name:participantName(row),rank:rankFor(row,field,slot)}))}
  function otherSelectionDetail(items:OtherSelection[]){const shown=items.slice(0,2).map(item=>`${item.name}${item.rank?` ${item.rank}순위`:''}`);if(items.length>2)shown.push(`외 ${items.length-2}명`);return shown.join(' · ')}
  function cellInterval(slot:string,field:FormField){const start=new Date(`${slot}:00+09:00`).getTime();return{start,end:start+(field.stepMinutes||30)*60_000}}
  function targetAssignmentId(){return selected&&activeField?assignmentFor(selected,activeField)?.id:null}
  function priority(a:Assignment){if(a.study_id===study.id&&selected&&activeField&&a.response_id===selected.id&&a.session_key===sessionKey(activeField))return 0;if(a.study_id===study.id)return 1;return 2}
  function assignmentCoveringCell(slot:string,field:FormField){const cell=cellInterval(slot,field);return allAssignments.filter(a=>blocksTime(a)&&overlap(cell.start,cell.end,a)).sort((a,b)=>priority(a)-priority(b))[0]||null}
  function fullConflict(slot:string,field:FormField){const start=new Date(`${slot}:00+09:00`).getTime(),end=start+(field.duration||60)*60_000;const ignore=targetAssignmentId();return allAssignments.find(a=>blocksTime(a)&&a.id!==ignore&&overlap(start,end,a))||null}
  function startsHere(a:Assignment,slot:string,field:FormField){const cell=cellInterval(slot,field),start=new Date(a.starts_at).getTime();return start>=cell.start&&start<cell.end}
  function priorMissing(row:ResponseRow,field:FormField){const index=fields.findIndex(f=>f.id===field.id);if(index<=0)return null;for(const prior of fields.slice(0,index))if(!assignmentFor(row,prior))return prior;return null}
  function conflictLabel(a:Assignment){return a.study_id===study.id?`${participantNameById(a.response_id)} · ${a.session_label}`:`${a.study?.title||'다른 실험'} · ${a.session_label}`}

  function participantProgress(row:ResponseRow){const activeRows=fields.map(f=>assignmentFor(row,f)).filter(Boolean) as Assignment[];const scheduled=activeRows.length;const handled=activeRows.filter(a=>a.status==='completed'||a.status==='no_show').length;return{scheduled,handled,total:fields.length}}
  function participantState(row:ResponseRow):PersonFilter{const p=participantProgress(row);if(p.total>0&&p.handled===p.total)return'done';if(p.scheduled===0)return'unscheduled';if(p.scheduled<p.total)return'partial';return'scheduled'}
  const orderedPeople=useMemo(()=>[...responses].sort((a,b)=>{const order:{[key:string]:number}={unscheduled:0,partial:1,scheduled:2,done:3};return order[participantState(a)]-order[participantState(b)]||participantName(a).localeCompare(participantName(b),'ko')}),[responses,assignments,fields])
  const shownPeople=useMemo(()=>{const term=query.trim().toLowerCase();return orderedPeople.filter(row=>(personFilter==='all'||participantState(row)===personFilter)&&(!term||[participantName(row),row.contact_email,row.contact_phone].filter(Boolean).join(' ').toLowerCase().includes(term)))},[orderedPeople,query,personFilter,assignments,fields])

  const currentAssignment=selected&&activeField?assignmentFor(selected,activeField):null
  const currentNotification=latestNotification(currentAssignment)
  const missingPrior=selected&&activeField?priorMissing(selected,activeField):null
  const legacyConflict=currentAssignment?allAssignments.find(a=>a.id!==currentAssignment.id&&a.study_id!==study.id&&blocksTime(a)&&overlap(new Date(currentAssignment.starts_at).getTime(),new Date(currentAssignment.ends_at).getTime(),a))||null:null

  function chooseSlot(slot:string){if(!selected||!activeField||missingPrior||!fieldAllowsSlot(activeField,slot))return;const participantSelected=(selected.availability?.[activeField.id]||[]).includes(slot);if(!participantSelected&&!directMode)return;if(fullConflict(slot,activeField))return;if(pendingSlot===slot){setPendingSlot(null);setPendingManual(false);return}setPendingSlot(slot);setPendingManual(!participantSelected)}

  async function confirmPending(){
    if(!selected||!activeField||!pendingSlot||busy)return
    const missing=priorMissing(selected,activeField);if(missing)return alert(`${missing.sessionLabel||missing.label} 일정을 먼저 확정해주세요.`)
    const participantSelected=(selected.availability?.[activeField.id]||[]).includes(pendingSlot);if(!participantSelected&&!pendingManual)return alert('직접 협의한 시간으로 다시 선택해주세요.')
    if(!fieldAllowsSlot(activeField,pendingSlot))return alert('관리자가 사용하지 않도록 막아둔 시간입니다.')
    const session=sessionKey(activeField);const start=new Date(`${pendingSlot}:00+09:00`),end=new Date(start.getTime()+(activeField.duration||60)*60_000)
    const conflict=fullConflict(pendingSlot,activeField);if(conflict)return alert(`${conflictLabel(conflict)} 일정과 겹칩니다.`)
    if(maxPerDay>0){const date=pendingSlot.split('T')[0];const sameDay=assignments.filter(a=>a.response_id===selected.id&&a.status!=='cancelled'&&a.session_key!==session&&kstSlot(a.starts_at).startsWith(date)).length;if(sameDay>=maxPerDay)return alert(`이 참가자는 하루에 최대 ${maxPerDay}개 세션만 배정할 수 있습니다.`)}
    setBusy(true)
    const{data:saved,error}=await supabase.from('assignments').upsert({study_id:study.id,response_id:selected.id,session_key:session,session_label:activeField.sessionLabel||activeField.label,starts_at:start.toISOString(),ends_at:end.toISOString(),status:'confirmed',scheduling_source:pendingManual?'admin_agreed':'participant_selection',agreement_confirmed_at:pendingManual?new Date().toISOString():null},{onConflict:'response_id,session_key'}).select('*').single()
    if(error){setBusy(false);return alert(error.message)}
    let result:NoticeResult;try{result=await sendScheduleNotification(saved.id)}catch(error){result={status:'failed',error:error instanceof Error?error.message:'메일 발송 실패'}}
    setEmailNotice(notificationMessage(result));setBusy(false);setPendingSlot(null);setPendingManual(false);setDirectMode(false)
    const index=fields.findIndex(field=>field.id===activeField.id);const next=fields.slice(index+1).find(field=>!assignmentFor(selected,field));await load();if(next)setActiveSessionKey(sessionKey(next))
  }

  async function retryNotification(a:Assignment){if(busy)return;setBusy(true);try{const result=await sendScheduleNotification(a.id);setEmailNotice(notificationMessage(result))}catch(error){setEmailNotice({ok:false,text:`안내 메일을 보내지 못했습니다. ${error instanceof Error?error.message:''}`})}setBusy(false);await load()}
  async function markAssignment(a:Assignment,status:'completed'|'no_show'){
    if(busy)return
    const label=status==='completed'?'완료':'불참'
    if(!confirm(`${a.session_label} 일정을 ${label} 처리할까요?`))return
    setBusy(true);const{error}=await supabase.from('assignments').update({status}).eq('id',a.id);setBusy(false)
    if(error)alert(error.message);else{setEmailNotice({ok:true,text:`${a.session_label} 일정을 ${label} 처리했습니다.`});await load()}
  }
  async function cancelAssignment(a:Assignment){
    if(busy)return
    if(!confirm(`${a.session_label} 일정을 취소하고 참가자에게 취소 안내 메일을 보낼까요?`))return
    setBusy(true);const{error}=await supabase.from('assignments').update({status:'cancelled'}).eq('id',a.id)
    if(error){setBusy(false);return alert(error.message)}
    let result:NoticeResult;try{result=await sendScheduleNotification(a.id,'cancelled')}catch(error){result={status:'failed',error:error instanceof Error?error.message:'메일 발송 실패'}}
    setEmailNotice(notificationMessage(result));setBusy(false);setPendingSlot(null);await load()
  }

  if(!fields.length)return<div className="empty">신청서에 시간 선택 문항을 먼저 추가해주세요.</div>

  const sidebar=<AdminSurface className="ss-people"><AdminPanelHeader title="참가자" meta={`${shownPeople.length}/${responses.length}명`} description="일정 상태로 좁혀서 확인할 수 있습니다."/><div className="ss-person-tools"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="이름 또는 연락처 검색"/><select value={personFilter} onChange={e=>setPersonFilter(e.target.value as PersonFilter)}><option value="all">전체</option><option value="unscheduled">일정 미정</option><option value="partial">일부 확정</option><option value="scheduled">전체 확정</option><option value="done">처리 완료</option></select></div><div className="aui-list">{shownPeople.map(row=>{const p=participantProgress(row);const state=participantState(row);const label=state==='done'?'모든 세션 처리됨':state==='scheduled'?'전체 일정 확정':state==='partial'?`${p.scheduled}/${p.total} 확정`:'일정 미정';return<AdminListItem key={row.id} active={selected?.id===row.id} title={participantName(row)} subtitle={row.contact_email||row.contact_phone||'연락처 없음'} status={<StatusBadge status={state==='done'?'completed':state==='scheduled'?'confirmed':'unassigned'} label={label}/>} onClick={()=>selectParticipant(row.id)}/>})}{!shownPeople.length&&<div className="empty compact">조건에 맞는 참가자가 없습니다.</div>}</div></AdminSurface>

  return<div className="ss-root">
    <AdminPageHeader kicker="SCHEDULE" title="일정 정하기" description="참가자의 가능 시간을 확인하고 확정하면 이메일로 안내합니다. 다른 StudyForm 실험의 일정과도 겹치지 않게 확인합니다."/>
    {emailNotice&&<div className={`notice ${emailNotice.ok?'good':''}`}>{emailNotice.text}</div>}
    <AdminSplitView sidebar={sidebar} sidebarWidth={320}><div className="ss-main">
      <AdminSurface className="ss-sessions"><AdminPanelHeader title={selected?`${participantName(selected)}의 세션`:'세션'} description="지금 조율할 세션을 선택합니다."/><div className="ss-session-list">{fields.map((field,index)=>{const a=selected?assignmentFor(selected,field):null;const label=a?.status==='completed'?'완료':a?.status==='no_show'?'불참':a?'확정':'미배정';return<button type="button" key={field.id} className={`ss-session ${activeField?.id===field.id?'active':''}`} onClick={()=>setActiveSessionKey(sessionKey(field))}><span className="ss-session-index">{index+1}</span><span className="ss-session-copy"><strong>{field.sessionLabel||field.label}</strong><small>{field.duration||60}분{a?` · ${fmtDateTime(a.starts_at)}`:''}{a?.scheduling_source==='admin_agreed'?' · 직접 협의':''}</small></span><StatusBadge status={a?.status==='completed'?'completed':a?.status==='no_show'?'danger':a?'confirmed':'unassigned'} label={label}/></button>})}</div></AdminSurface>

      {selected&&activeField&&<AdminSurface className="ss-current"><div className="ss-current-copy"><small>{participantName(selected)} · {activeField.sessionLabel||activeField.label}</small>{currentAssignment?<><strong>{fmtDateTime(currentAssignment.starts_at)}</strong><span>{currentAssignment.status==='completed'?'완료된 세션입니다.':currentAssignment.status==='no_show'?'참가자 불참으로 기록되었습니다.':currentAssignment.scheduling_source==='admin_agreed'?'참가자와 직접 협의해 확정한 시간입니다.':'현재 확정된 일정입니다.'}</span>{legacyConflict&&<span className="ss-legacy-warning">기존 일정이 {legacyConflict.study?.title||'다른 실험'} · {legacyConflict.session_label}과 겹칩니다.</span>}</>:<><strong>아직 정해진 일정이 없습니다.</strong><span>{missingPrior?`${missingPrior.sessionLabel||missingPrior.label}을 먼저 확정해주세요.`:'참가자가 제출한 시간에서 선택하거나, 별도 협의한 시간을 직접 지정할 수 있습니다.'}</span></>}</div>{currentAssignment&&<div className="ss-current-actions">{currentAssignment.status==='confirmed'&&<>{currentNotification?<StatusBadge status={currentNotification.status==='sent'?'confirmed':currentNotification.status==='failed'?'danger':currentNotification.status==='pending'?'info':'neutral'} label={currentNotification.status==='sent'?'안내 메일 전송됨':currentNotification.status==='failed'?'안내 메일 실패':currentNotification.status==='pending'?'메일 전송 중':'신청 이메일 없음'}/>:<StatusBadge status="neutral" label="안내 미전송"/>}{currentNotification?.status!=='sent'&&<button className="btn secondary small" disabled={busy} onClick={()=>retryNotification(currentAssignment)}>{currentNotification?.status==='failed'?'다시 보내기':'안내 메일 보내기'}</button>}<button className="btn secondary small" disabled={busy} onClick={()=>markAssignment(currentAssignment,'completed')}>완료</button><button className="btn ghost small" disabled={busy} onClick={()=>markAssignment(currentAssignment,'no_show')}>불참</button><button className="btn ghost small" disabled={busy} onClick={()=>cancelAssignment(currentAssignment)}>일정 취소</button></>}{currentAssignment.status==='completed'&&<StatusBadge status="completed" label="완료"/>}{currentAssignment.status==='no_show'&&<StatusBadge status="danger" label="불참"/>}</div>}</AdminSurface>}

      {selected&&activeField&&<AdminSurface className="ss-grid-panel"><div className="ss-grid-head"><div><h3>{activeField.sessionLabel||activeField.label} 시간표</h3><p>현재 참가자의 선택, 다른 참가자의 선택, 실제 예약만 표시합니다.</p></div><div className="ss-grid-tools"><div className="ss-legend"><span><i className="available"/>선택 가능</span><span><i className="preferred"/>1·2순위</span><span><i className="others"/>다른 참가자 선택</span><span><i className="chosen"/>선택됨</span><span><i className="current"/>현재 일정</span><span><i className="occupied"/>같은 실험 예약</span><span><i className="external"/>다른 실험</span></div><button type="button" className={`btn small ${directMode?'':'ghost'}`} disabled={!!missingPrior||busy} onClick={()=>{setDirectMode(value=>!value);setPendingSlot(null);setPendingManual(false)}}>{directMode?'직접 협의 모드 종료':'직접 협의한 시간 지정'}</button></div></div>
        {directMode&&<div className="ss-direct-note"><strong>직접 협의 모드</strong><span>참가자에게 별도로 연락해 동의를 받은 경우에만 빈 시간을 선택하세요.</span></div>}{missingPrior&&<div className="ss-blocked-note">먼저 <b>{missingPrior.sessionLabel||missingPrior.label}</b> 일정을 확정해야 이 세션을 정할 수 있습니다.</div>}
        <div className="ss-grid-scroll"><div className="ss-grid" style={{gridTemplateColumns:`78px repeat(${Math.max(dates.length,1)}, minmax(170px,1fr))`}}><div className="ss-corner">시간</div>{dates.map(day=><div className="ss-date" key={day}>{fmtDay(day)}</div>)}{times.flatMap(time=>[<div className="ss-time" key={`time-${time}`}>{time}</div>,...dates.map(day=>{const slot=`${day}T${time}`;const available=(selected.availability?.[activeField.id]||[]).includes(slot);const rank=rankFor(selected,activeField,slot);const others=otherSelections(activeField,slot,selected.id);const covering=assignmentCoveringCell(slot,activeField);const own=!!covering&&covering.study_id===study.id&&covering.response_id===selected.id&&covering.session_key===sessionKey(activeField);const external=!!covering&&covering.study_id!==study.id;const start=covering?startsHere(covering,slot,activeField):false;const chosen=pendingSlot===slot;const allowedByField=fieldAllowsSlot(activeField,slot);const conflict=fullConflict(slot,activeField);const manualOption=directMode&&!available&&!covering&&!conflict&&allowedByField&&!missingPrior;const state=covering?own?'current':external?'external':'occupied':chosen?'chosen':conflict?'conflict':available?rank?'preferred':'available':others.length?'others':manualOption?'manual-option':'empty';const canChoose=!missingPrior&&!covering&&!conflict&&allowedByField&&(available||directMode)&&!busy;return<button type="button" key={slot} title={conflict?conflictLabel(conflict):undefined} className={`ss-cell ${state}`} disabled={!canChoose} onClick={()=>chooseSlot(slot)}>{covering?own?(start?<><strong>{covering.status==='completed'?'완료':covering.status==='no_show'?'불참':'확정됨'}</strong>{covering.scheduling_source==='admin_agreed'&&<small>직접 협의</small>}</>:null):external?(start?<><strong>다른 실험</strong><small>{covering.study?.title||'다른 실험'} · {covering.session_label}</small></>:null):(start?<><strong>예약됨</strong><small>{participantNameById(covering.response_id)}</small></>:null):chosen?<><strong>{pendingManual?'직접 협의':'선택됨'}</strong>{!pendingManual&&rank>0&&<small>{rank}순위</small>}</>:conflict?<><strong>일정과 겹침</strong><small>{conflictLabel(conflict)}</small></>:available?<><strong>{rank?`${rank}순위`:'선택 가능'}</strong>{others.length>0&&<><small>다른 참가자 {others.length}명 선택</small><small className="ss-cell-others">{otherSelectionDetail(others)}</small></>}</>:others.length>0?<><strong>다른 참가자 {others.length}명 선택</strong><small className="ss-cell-others">{otherSelectionDetail(others)}</small></>:null}</button>})])}</div></div>
      </AdminSurface>}

      {selected&&activeField&&pendingSlot&&<div className={`ss-confirm-bar ${pendingManual?'manual':''}`}><div><small>{pendingManual?'참가자와 별도 협의한 시간':'아직 저장되지 않은 선택'}</small><strong>{participantName(selected)} · {activeField.sessionLabel||activeField.label}</strong><span>{fmtDateTime(new Date(`${pendingSlot}:00+09:00`).toISOString())} · {activeField.duration||60}분</span></div><div className="ss-confirm-actions"><button className="btn secondary" onClick={()=>{setPendingSlot(null);setPendingManual(false)}}>선택 취소</button><button className="btn" disabled={busy} onClick={confirmPending}>{busy?'저장 중…':pendingManual?'직접 협의 시간으로 확정':currentAssignment?'이 시간으로 변경':'이 시간으로 확정'}</button></div></div>}
    </div></AdminSplitView>
  </div>
}
