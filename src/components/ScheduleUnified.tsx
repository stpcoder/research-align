'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FormField, ResponseRow, Study } from '@/lib/types'
import { AdminListItem, AdminPageHeader, AdminPanelHeader, AdminSplitView, AdminSurface, StatusBadge } from '@/components/admin/AdminUI'

type Assignment={id:string;study_id:string;response_id:string;session_key:string;session_label:string;starts_at:string;ends_at:string;status:'confirmed'|'completed'|'cancelled'}

const fmtDateTime=(iso:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))
const fmtDay=(day:string)=>new Date(`${day}T00:00:00+09:00`).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric',weekday:'short'})
function kstSlot(iso:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso));const get=(t:string)=>parts.find(p=>p.type===t)?.value||'';return`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`}
function buildTimes(field:FormField){const[start,end]=(field.hours||'10:00-18:00').split('-');const[sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number);const step=Math.max(5,field.stepMinutes||30);const result:string[]=[];for(let minute=sh*60+sm;minute<eh*60+em;minute+=step)result.push(`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`);return result}

export default function ScheduleUnified({study}:{study:Study}){
  const[responses,setResponses]=useState<ResponseRow[]>([])
  const[assignments,setAssignments]=useState<Assignment[]>([])
  const[selectedId,setSelectedId]=useState('')
  const[activeSessionKey,setActiveSessionKey]=useState('')
  const[pendingSlot,setPendingSlot]=useState<string|null>(null)
  const[busy,setBusy]=useState(false)

  const rawFields=useMemo(()=>study.form_config.fields.filter(f=>f.type==='availability'),[study.form_config.fields])
  const configuredOrder=(study.scheduling_config?.sessionOrder as string[]|undefined)||[]
  const sessionKey=(field:FormField)=>field.sessionKey||field.id
  const fields=useMemo(()=>{
    const ordered=configuredOrder.map(key=>rawFields.find(field=>sessionKey(field)===key)).filter(Boolean) as FormField[]
    const remaining=rawFields.filter(field=>!configuredOrder.includes(sessionKey(field)))
    return[...ordered,...remaining]
  },[rawFields,configuredOrder.join('|')])
  const nameField=useMemo(()=>study.form_config.fields.find(f=>f.type==='short'&&/이름|name/i.test(f.label))||study.form_config.fields.find(f=>f.type==='short'),[study.form_config.fields])
  const selected=responses.find(row=>row.id===selectedId)||responses[0]||null
  const activeField=fields.find(field=>sessionKey(field)===activeSessionKey)||fields[0]||null
  const maxPerDay=Number(study.scheduling_config?.maxSessionsPerDay||0)

  function participantName(row:ResponseRow){if(nameField){const value=row.answers?.[nameField.id];if(typeof value==='string'&&value.trim())return value}return row.contact_email||row.contact_phone||'참가자'}
  function participantNameById(id:string){const row=responses.find(item=>item.id===id);return row?participantName(row):'참가자'}
  function assignmentFor(row:ResponseRow,field:FormField){return assignments.find(a=>a.response_id===row.id&&a.session_key===sessionKey(field)&&a.status!=='cancelled')||null}

  async function load(){
    const[{data:r},{data:a}]=await Promise.all([
      supabase.from('responses').select('*').eq('study_id',study.id).order('submitted_at'),
      supabase.from('assignments').select('*').eq('study_id',study.id).order('starts_at'),
    ])
    const nextResponses=(r||[]) as ResponseRow[]
    setResponses(nextResponses)
    setAssignments((a||[]) as Assignment[])
    setSelectedId(current=>current&&nextResponses.some(row=>row.id===current)?current:nextResponses[0]?.id||'')
    setActiveSessionKey(current=>current&&fields.some(field=>sessionKey(field)===current)?current:fields[0]?sessionKey(fields[0]):'')
  }
  useEffect(()=>{load()},[study.id])
  useEffect(()=>{setPendingSlot(null)},[selectedId,activeSessionKey])

  function firstUnscheduledField(row:ResponseRow){return fields.find(field=>!assignmentFor(row,field))||fields[0]||null}
  function selectParticipant(id:string){
    const row=responses.find(item=>item.id===id)
    setSelectedId(id)
    setPendingSlot(null)
    const next=row?firstUnscheduledField(row):null
    if(next)setActiveSessionKey(sessionKey(next))
  }

  const dates=useMemo(()=>{
    if(!activeField)return[]
    if(activeField.dates?.length)return activeField.dates
    const set=new Set<string>()
    for(const response of responses)for(const slot of response.availability?.[activeField.id]||[])set.add(slot.split('T')[0])
    return[...set].sort()
  },[activeField,responses])
  const times=useMemo(()=>activeField?buildTimes(activeField):[],[activeField])

  function rankFor(row:ResponseRow,field:FormField,slot:string){const pref=row.preferences?.[field.id]||{};const found=Object.entries(pref).find(([,value])=>value===slot);return found?Number(found[0]):0}
  function otherAvailabilityCount(field:FormField,slot:string,rowId:string){return responses.reduce((count,row)=>count+(row.id!==rowId&&(row.availability?.[field.id]||[]).includes(slot)?1:0),0)}
  function cellInterval(slot:string,field:FormField){const start=new Date(`${slot}:00+09:00`).getTime();return{start,end:start+(field.stepMinutes||30)*60_000}}
  function assignmentCoveringCell(slot:string,field:FormField){const cell=cellInterval(slot,field);return assignments.find(a=>{if(a.status==='cancelled')return false;const start=new Date(a.starts_at).getTime(),end=new Date(a.ends_at).getTime();return cell.start<end&&cell.end>start})||null}
  function startsHere(a:Assignment,slot:string,field:FormField){const cell=cellInterval(slot,field),start=new Date(a.starts_at).getTime();return start>=cell.start&&start<cell.end}
  function priorMissing(row:ResponseRow,field:FormField){const index=fields.findIndex(f=>f.id===field.id);if(index<=0)return null;for(const prior of fields.slice(0,index))if(!assignmentFor(row,prior))return prior;return null}

  function participantProgress(row:ResponseRow){let confirmed=0;for(const field of fields)if(assignmentFor(row,field))confirmed++;return{confirmed,total:fields.length}}
  const orderedPeople=useMemo(()=>[...responses].sort((a,b)=>{const ap=participantProgress(a),bp=participantProgress(b);const ar=ap.confirmed===ap.total?2:ap.confirmed>0?1:0,br=bp.confirmed===bp.total?2:bp.confirmed>0?1:0;return ar-br||participantName(a).localeCompare(participantName(b),'ko')}),[responses,assignments,fields])

  const currentAssignment=selected&&activeField?assignmentFor(selected,activeField):null
  const missingPrior=selected&&activeField?priorMissing(selected,activeField):null

  function chooseSlot(slot:string){
    if(!selected||!activeField||missingPrior)return
    if(!(selected.availability?.[activeField.id]||[]).includes(slot))return
    const start=new Date(`${slot}:00+09:00`).getTime(),end=start+(activeField.duration||60)*60_000
    const conflict=assignments.find(a=>{if(a.status==='cancelled')return false;if(a.response_id===selected.id&&a.session_key===sessionKey(activeField))return false;const s=new Date(a.starts_at).getTime(),e=new Date(a.ends_at).getTime();return start<e&&end>s})
    if(conflict)return
    setPendingSlot(current=>current===slot?null:slot)
  }

  async function confirmPending(){
    if(!selected||!activeField||!pendingSlot||busy)return
    const missing=priorMissing(selected,activeField)
    if(missing)return alert(`${missing.sessionLabel||missing.label} 일정을 먼저 확정해주세요.`)
    if(!(selected.availability?.[activeField.id]||[]).includes(pendingSlot))return alert('참가자가 선택하지 않은 시간입니다.')
    const session=sessionKey(activeField)
    const start=new Date(`${pendingSlot}:00+09:00`),end=new Date(start.getTime()+(activeField.duration||60)*60_000)
    const conflict=assignments.find(a=>{if(a.status==='cancelled')return false;if(a.response_id===selected.id&&a.session_key===session)return false;const s=new Date(a.starts_at).getTime(),e=new Date(a.ends_at).getTime();return start.getTime()<e&&end.getTime()>s})
    if(conflict)return alert(`${participantNameById(conflict.response_id)} 참가자의 ${conflict.session_label} 일정과 겹칩니다.`)
    if(maxPerDay>0){const date=pendingSlot.split('T')[0];const sameDay=assignments.filter(a=>a.response_id===selected.id&&a.status!=='cancelled'&&a.session_key!==session&&kstSlot(a.starts_at).startsWith(date)).length;if(sameDay>=maxPerDay)return alert(`이 참가자는 하루에 최대 ${maxPerDay}개 세션만 배정할 수 있습니다.`)}
    setBusy(true)
    const{error}=await supabase.from('assignments').upsert({study_id:study.id,response_id:selected.id,session_key:session,session_label:activeField.sessionLabel||activeField.label,starts_at:start.toISOString(),ends_at:end.toISOString(),status:'confirmed'},{onConflict:'response_id,session_key'})
    setBusy(false)
    if(error)return alert(error.message)
    setPendingSlot(null)
    const index=fields.findIndex(field=>field.id===activeField.id)
    const next=fields.slice(index+1).find(field=>!assignmentFor(selected,field))
    await load()
    if(next)setActiveSessionKey(sessionKey(next))
  }

  async function removeAssignment(a:Assignment){if(a.status==='completed')return;if(!confirm('현재 확정된 일정을 삭제할까요?'))return;setBusy(true);const{error}=await supabase.from('assignments').delete().eq('id',a.id);setBusy(false);if(error)alert(error.message);else await load()}

  if(!fields.length)return<div className="empty">신청서에 시간 선택 문항을 먼저 추가해주세요.</div>

  const sidebar=<AdminSurface className="ss-people"><AdminPanelHeader title="참가자" meta={`${responses.length}명`} description="참가자를 선택하면 아직 일정이 없는 첫 세션으로 이동합니다."/><div className="aui-list">{orderedPeople.map(row=>{const progress=participantProgress(row);const done=progress.total>0&&progress.confirmed===progress.total;const label=done?'모든 일정 완료':`${progress.confirmed}/${progress.total} 확정`;return<AdminListItem key={row.id} active={selected?.id===row.id} title={participantName(row)} subtitle={row.contact_email||row.contact_phone||'연락처 없음'} status={<StatusBadge status={done?'confirmed':'unassigned'} label={label}/>} onClick={()=>selectParticipant(row.id)}/>})}</div></AdminSurface>

  return<div className="ss-root">
    <AdminPageHeader kicker="SCHEDULE" title="일정 정하기" description="참가자 → 세션 → 시간 순서로 고르고, 마지막 확정 버튼을 눌렀을 때만 저장됩니다."/>
    <div className="ss-steps"><span className={selected?'done':''}>1 참가자</span><span>→</span><span className={activeField?'done':''}>2 세션</span><span>→</span><span className={pendingSlot?'done':''}>3 시간</span><span>→</span><span className={currentAssignment&&!pendingSlot?'done':''}>4 확정</span></div>
    <AdminSplitView sidebar={sidebar} sidebarWidth={300}>
      <div className="ss-main">
        <AdminSurface className="ss-sessions">
          <AdminPanelHeader title={selected?`${participantName(selected)}의 세션`:'세션'} description="모든 세션을 한 번에 보고, 지금 정할 세션 하나만 선택합니다."/>
          <div className="ss-session-list">{fields.map((field,index)=>{const a=selected?assignmentFor(selected,field):null;const completed=a?.status==='completed';return<button type="button" key={field.id} className={`ss-session ${activeField?.id===field.id?'active':''}`} onClick={()=>setActiveSessionKey(sessionKey(field))}><span className="ss-session-index">{index+1}</span><span className="ss-session-copy"><strong>{field.sessionLabel||field.label}</strong><small>{field.duration||60}분{a?` · ${fmtDateTime(a.starts_at)}`:''}</small></span><StatusBadge status={completed?'completed':a?'confirmed':'unassigned'} label={completed?'완료':a?'확정':'미배정'}/></button>})}</div>
        </AdminSurface>

        {selected&&activeField&&<AdminSurface className="ss-current">
          <div className="ss-current-copy"><small>{participantName(selected)} · {activeField.sessionLabel||activeField.label}</small>{currentAssignment?<><strong>{fmtDateTime(currentAssignment.starts_at)}</strong><span>{currentAssignment.status==='completed'?'완료된 일정입니다.':'현재 확정된 일정입니다. 다른 시간을 선택한 뒤 확정하면 변경됩니다.'}</span></>:<><strong>아직 정해진 일정이 없습니다.</strong><span>{missingPrior?`${missingPrior.sessionLabel||missingPrior.label}을 먼저 확정해주세요.`:'아래에서 참가자가 선택한 시간 하나를 고르세요.'}</span></>}</div>{currentAssignment?.status==='confirmed'&&<div className="ss-current-actions"><button className="btn ghost" disabled={busy} onClick={()=>removeAssignment(currentAssignment)}>일정 삭제</button></div>}
        </AdminSurface>}

        {selected&&activeField&&<AdminSurface className="ss-grid-panel">
          <div className="ss-grid-head"><div><h3>{activeField.sessionLabel||activeField.label} 시간표</h3><p>셀을 눌러도 바로 저장되지 않습니다. 검은 테두리의 ‘선택됨’을 확인한 뒤 아래 확정 버튼을 누르세요.</p></div><div className="ss-legend"><span><i className="available"/>선택 가능</span><span><i className="preferred"/>선호 시간</span><span><i className="chosen"/>선택됨</span><span><i className="current"/>현재 확정</span><span><i className="occupied"/>예약됨</span></div></div>
          {missingPrior&&<div className="ss-blocked-note">먼저 <b>{missingPrior.sessionLabel||missingPrior.label}</b> 일정을 확정해야 이 세션을 정할 수 있습니다.</div>}
          <div className="ss-grid-scroll"><div className="ss-grid" style={{gridTemplateColumns:`78px repeat(${Math.max(dates.length,1)}, minmax(170px,1fr))`}}><div className="ss-corner">시간</div>{dates.map(day=><div className="ss-date" key={day}>{fmtDay(day)}</div>)}{times.flatMap(time=>[<div className="ss-time" key={`time-${time}`}>{time}</div>,...dates.map(day=>{const slot=`${day}T${time}`;const available=(selected.availability?.[activeField.id]||[]).includes(slot);const rank=rankFor(selected,activeField,slot);const others=otherAvailabilityCount(activeField,slot,selected.id);const covering=assignmentCoveringCell(slot,activeField);const own=!!covering&&covering.response_id===selected.id&&covering.session_key===sessionKey(activeField);const start=covering?startsHere(covering,slot,activeField):false;const chosen=pendingSlot===slot;const state=covering?own?'current':'occupied':chosen?'chosen':available?rank?'preferred':'available':'unavailable';const canChoose=!missingPrior&&!covering&&available&&!busy;return<button type="button" key={slot} className={`ss-cell ${state}`} disabled={!canChoose} onClick={()=>chooseSlot(slot)}>{covering?own?<><span className="ss-cell-label">현재 확정</span><strong>{start?`${participantName(selected)} · ${covering.session_label}`:'내 일정 진행 중'}</strong><small>{start?fmtDateTime(covering.starts_at):'현재 일정에 포함된 시간'}</small></>:<><span className="ss-cell-label">예약됨</span><strong>{start?`${participantNameById(covering.response_id)} · ${covering.session_label}`:'다른 일정 진행 중'}</strong><small>{available?`${participantName(selected)}도 선택했던 시간`:'다른 사람에게 이미 배정됨'}</small></>:chosen?<><span className="ss-cell-label">선택됨</span><strong>{rank?`${rank}순위 선호 시간`:'참가자 가능 시간'}</strong><small>아직 저장되지 않았습니다.</small></>:available?<><span className="ss-cell-label">선택 가능</span><strong>{rank?`${rank}순위 선호`:'참가자 가능'}</strong><small>{others?`다른 신청자 ${others}명도 가능`:'다른 신청자 선택 없음'}</small></>:<><span className="ss-cell-label">선택 불가</span><strong>이 참가자가 선택하지 않음</strong><small>{others?`다른 신청자 ${others}명은 가능`:'—'}</small></>}</button>})])}</div></div>
        </AdminSurface>}

        {selected&&activeField&&pendingSlot&&<div className="ss-confirm-bar"><div><small>아직 저장되지 않은 선택</small><strong>{participantName(selected)} · {activeField.sessionLabel||activeField.label}</strong><span>{fmtDateTime(new Date(`${pendingSlot}:00+09:00`).toISOString())} · {activeField.duration||60}분</span></div><div className="ss-confirm-actions"><button className="btn secondary" onClick={()=>setPendingSlot(null)}>선택 취소</button><button className="btn" disabled={busy} onClick={confirmPending}>{busy?'저장 중…':currentAssignment?'이 시간으로 변경':'이 시간으로 확정'}</button></div></div>}
      </div>
    </AdminSplitView>
  </div>
}
