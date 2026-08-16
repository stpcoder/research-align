'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FormField, ResponseRow, Study } from '@/lib/types'

type Assignment={id:string;study_id:string;response_id:string;session_key:string;session_label:string;starts_at:string;ends_at:string;status:'draft'|'confirmed'|'completed'|'cancelled'}
type Mode='person'|'bulk'

const fmtDateTime=(iso:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))
const fmtDay=(day:string)=>new Date(`${day}T00:00:00+09:00`).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric',weekday:'short'})
function kstSlot(iso:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso));const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';return`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`}
function buildTimelineTimes(field:FormField){const[start,end]=(field.hours||'10:00-18:00').split('-');const[sh,sm]=start.split(':').map(Number);const[eh,em]=end.split(':').map(Number);const step=Math.max(5,field.stepMinutes||30);const result:string[]=[];for(let minute=sh*60+sm;minute<eh*60+em;minute+=step)result.push(`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`);return result}
function stateLabel(status:Assignment['status']){if(status==='confirmed')return'확정';if(status==='completed')return'완료';return'미확정'}

export default function ScheduleManager({study}:{study:Study}){
  const[responses,setResponses]=useState<ResponseRow[]>([])
  const[assignments,setAssignments]=useState<Assignment[]>([])
  const[selectedId,setSelectedId]=useState('')
  const[sessionKey,setSessionKey]=useState('')
  const[mode,setMode]=useState<Mode>('person')
  const[busy,setBusy]=useState(false)

  const fields=useMemo(()=>study.form_config.fields.filter(f=>f.type==='availability'),[study.form_config.fields])
  const nameField=useMemo(()=>study.form_config.fields.find(f=>f.type==='short'&&/이름|name/i.test(f.label))||study.form_config.fields.find(f=>f.type==='short'),[study.form_config.fields])
  const activeField=fields.find(f=>(f.sessionKey||f.id)===sessionKey)||fields[0]||null
  const selected=responses.find(r=>r.id===selectedId)||responses[0]||null
  const sessionOrder=(study.scheduling_config?.sessionOrder as string[]|undefined)||fields.map(f=>f.sessionKey||f.id)
  const maxPerDay=Number(study.scheduling_config?.maxSessionsPerDay||0)

  const dates=useMemo(()=>{if(!activeField)return[];if(activeField.dates?.length)return activeField.dates;const set=new Set<string>();for(const response of responses)for(const slot of response.availability?.[activeField.id]||[])set.add(slot.split('T')[0]);return[...set].sort()},[activeField,responses])
  const times=useMemo(()=>activeField?buildTimelineTimes(activeField):[],[activeField])

  function participantName(row:ResponseRow){if(nameField){const value=row.answers?.[nameField.id];if(typeof value==='string'&&value.trim())return value}return row.contact_email||row.contact_phone||'참가자'}
  function participantNameById(id:string){const row=responses.find(r=>r.id===id);return row?participantName(row):'참가자'}
  function participantSessionAssignment(row:ResponseRow,field:FormField){const key=field.sessionKey||field.id;return assignments.find(a=>a.response_id===row.id&&a.session_key===key&&a.status!=='cancelled')||null}

  async function load(){const[{data:r},{data:a}]=await Promise.all([supabase.from('responses').select('*').eq('study_id',study.id).order('submitted_at'),supabase.from('assignments').select('*').eq('study_id',study.id).order('starts_at')]);const next=(r||[]) as ResponseRow[];setResponses(next);setAssignments((a||[]) as Assignment[]);setSessionKey(current=>current||fields[0]?.sessionKey||fields[0]?.id||'');setSelectedId(current=>current||next[0]?.id||'')}
  useEffect(()=>{load()},[study.id])

  const orderedResponses=useMemo(()=>{if(!activeField)return responses;const rank=(row:ResponseRow)=>{const a=participantSessionAssignment(row,activeField);if(!a)return 0;if(a.status==='draft')return 1;return 2};return[...responses].sort((a,b)=>rank(a)-rank(b)||participantName(a).localeCompare(participantName(b),'ko'))},[responses,assignments,activeField])
  const currentAssignment=selected&&activeField?participantSessionAssignment(selected,activeField):null
  const sessionAssignments=activeField?assignments.filter(a=>a.session_key===(activeField.sessionKey||activeField.id)&&a.status!=='cancelled'):[]
  const draftAssignments=sessionAssignments.filter(a=>a.status==='draft')
  const statusCounts=useMemo(()=>{if(!activeField)return{unassigned:0,draft:0,confirmed:0};let unassigned=0,draft=0,confirmed=0;for(const row of responses){const a=participantSessionAssignment(row,activeField);if(!a)unassigned++;else if(a.status==='draft')draft++;else confirmed++}return{unassigned,draft,confirmed}},[responses,assignments,activeField])

  function rankFor(row:ResponseRow,field:FormField,slot:string){const pref=row.preferences?.[field.id]||{};const found=Object.entries(pref).find(([,value])=>value===slot);return found?Number(found[0]):0}
  function availableCount(field:FormField,slot:string){return responses.reduce((count,row)=>count+((row.availability?.[field.id]||[]).includes(slot)&&!participantSessionAssignment(row,field)?1:0),0)}
  function assignmentCovering(field:FormField,slot:string){const session=field.sessionKey||field.id;const point=new Date(`${slot}:00+09:00`).getTime();return assignments.find(a=>a.session_key===session&&a.status!=='cancelled'&&point>=new Date(a.starts_at).getTime()&&point<new Date(a.ends_at).getTime())||null}

  async function assign(field:FormField,slot:string){
    if(!selected||busy)return
    const session=field.sessionKey||field.id
    const selectedSlots=selected.availability?.[field.id]||[]
    if(!selectedSlots.includes(slot))return
    const existing=participantSessionAssignment(selected,field)
    const wasUnassigned=!existing
    if(existing?.status==='confirmed'&&!confirm('이미 확정된 일정입니다. 다른 시간으로 변경하면 다시 미확정 상태가 됩니다. 변경할까요?'))return
    const start=new Date(`${slot}:00+09:00`);const end=new Date(start.getTime()+(field.duration||60)*60_000)
    const overlap=assignments.find(a=>{if(a.status==='cancelled')return false;if(a.response_id===selected.id&&a.session_key===session)return false;const s=new Date(a.starts_at).getTime(),e=new Date(a.ends_at).getTime();return start.getTime()<e&&end.getTime()>s})
    if(overlap){alert(`${participantNameById(overlap.response_id)} 참가자의 기존 일정과 겹칩니다.`);return}
    if(maxPerDay>0){const date=slot.split('T')[0];const sameDay=assignments.filter(a=>a.response_id===selected.id&&a.status!=='cancelled'&&a.session_key!==session&&kstSlot(a.starts_at).startsWith(date)).length;if(sameDay>=maxPerDay){alert(`이 참가자는 하루에 최대 ${maxPerDay}개 세션만 배정할 수 있습니다.`);return}}
    const orderIndex=sessionOrder.indexOf(session)
    if(orderIndex>0){const missing=sessionOrder.slice(0,orderIndex).find(key=>!assignments.some(a=>a.response_id===selected.id&&a.session_key===key&&a.status!=='cancelled'));if(missing){const prior=fields.find(f=>(f.sessionKey||f.id)===missing);alert(`${prior?.sessionLabel||'이전 세션'} 일정을 먼저 배정해주세요.`);return}}
    const nextCandidate=mode==='bulk'&&wasUnassigned?orderedResponses.find(row=>row.id!==selected.id&&!participantSessionAssignment(row,field)):null
    setBusy(true)
    const{error}=await supabase.from('assignments').upsert({study_id:study.id,response_id:selected.id,session_key:session,session_label:field.sessionLabel||field.label,starts_at:start.toISOString(),ends_at:end.toISOString(),status:'draft'},{onConflict:'response_id,session_key'})
    setBusy(false)
    if(error)alert(error.message);else{await load();if(nextCandidate)setSelectedId(nextCandidate.id)}
  }

  async function confirmAssignment(a:Assignment){setBusy(true);await supabase.from('assignments').update({status:'confirmed'}).eq('id',a.id);setBusy(false);await load()}
  async function unconfirmAssignment(a:Assignment){setBusy(true);await supabase.from('assignments').update({status:'draft'}).eq('id',a.id);setBusy(false);await load()}
  async function confirmAllDrafts(){if(!draftAssignments.length)return;if(!confirm(`${draftAssignments.length}개의 미확정 일정을 모두 확정할까요?`))return;setBusy(true);const{error}=await supabase.from('assignments').update({status:'confirmed'}).in('id',draftAssignments.map(a=>a.id));setBusy(false);if(error)alert(error.message);else await load()}
  async function removeAssignment(a:Assignment){if(!confirm(`${participantNameById(a.response_id)} 참가자의 ${a.session_label} 배정을 취소할까요?`))return;await supabase.from('assignments').delete().eq('id',a.id);await load()}

  if(!fields.length)return<div className="empty">신청서에 시간 선택 문항을 먼저 추가해주세요.</div>

  const renderGrid=(bulk:boolean)=>selected&&activeField?<section className="schedule-v2-grid-card card">
    <div className="schedule-v2-grid-head"><div><h3>{bulk?'전체 타임테이블':'타임테이블'}</h3><p className="muted small">{bulk?`${participantName(selected)}님을 배치할 수 있는 시간은 강조됩니다. 이미 배정된 사람도 함께 보입니다.`:`${participantName(selected)}님이 신청한 시간과 현재 배정 상태를 함께 보여줍니다.`}</p></div><div className="schedule-v2-legend"><span><i className="available"/>배정 가능</span><span><i className="preferred"/>선호 시간</span><span><i className="draft"/>미확정</span><span><i className="confirmed"/>확정</span><span><i className="occupied"/>다른 일정</span></div></div>
    <div className="schedule-v2-scroll"><div className="schedule-v2-grid" style={{gridTemplateColumns:`72px repeat(${Math.max(dates.length,1)}, minmax(150px,1fr))`}}><div className="schedule-grid-corner">시간</div>{dates.map(day=><div className="schedule-grid-date" key={day}>{fmtDay(day)}</div>)}{times.flatMap(time=>[<div className="schedule-grid-time" key={`time-${time}`}>{time}</div>,...dates.map(day=>{const slot=`${day}T${time}`;const available=(selected.availability?.[activeField.id]||[]).includes(slot);const rank=rankFor(selected,activeField,slot);const covering=assignmentCovering(activeField,slot);const mine=covering?.response_id===selected.id;const startsHere=covering?kstSlot(covering.starts_at)===slot:false;const count=availableCount(activeField,slot);const state=mine?(covering?.status==='confirmed'?'mine-confirmed':'mine-draft'):covering?(covering.status==='confirmed'?'confirmed':'draft'):available?(rank>0?'preferred':'available'):'unavailable';const canAssign=available&&!covering&&!busy;return<button type="button" key={slot} className={`schedule-grid-cell ${state}`} disabled={!canAssign} onClick={()=>assign(activeField,slot)}>{covering?<>{startsHere?<><strong>{participantNameById(covering.response_id)}</strong><span>{stateLabel(covering.status)}</span></>:<span>일정 진행 중</span>}</>:available?<><strong>{rank>0?`${rank}순위`:'배정 가능'}</strong><span>{count>1?`미배정 ${count}명 가능`:'클릭하여 배정'}</span></>:<span>{bulk&&count>0?`${count}명 가능`:'—'}</span>}</button>})])}</div></div>
  </section>:null

  return<div className="schedule-v2">
    <header className="schedule-v2-head"><div><span className="admin-kicker">SCHEDULE</span><h2>일정 배정</h2><p className="muted">미배정 참가자를 시간에 배치하고, 미확정 일정을 검토한 뒤 확정합니다.</p></div><div><div className="schedule-mode-switch"><button className={mode==='person'?'active':''} onClick={()=>setMode('person')}>참가자별 배정</button><button className={mode==='bulk'?'active':''} onClick={()=>setMode('bulk')}>전체 배정</button></div><div className="schedule-progress"><span><b>{statusCounts.unassigned}</b> 미배정</span><span className="draft"><b>{statusCounts.draft}</b> 미확정</span><span className="confirmed"><b>{statusCounts.confirmed}</b> 확정</span></div></div></header>

    <div className="schedule-session-tabs">{fields.map(field=>{const key=field.sessionKey||field.id;return<button type="button" key={field.id} className={activeField?.id===field.id?'active':''} onClick={()=>setSessionKey(key)}><strong>{field.sessionLabel||field.label}</strong><span>{field.duration||60}분</span></button>})}</div>

    {mode==='person'?<div className="schedule-v2-layout">
      <aside className="schedule-v2-people card"><div className="schedule-pane-title"><h3>참가자</h3><span>{responses.length}명</span></div><div className="schedule-person-list">{orderedResponses.map(row=>{const a=activeField?participantSessionAssignment(row,activeField):null;const state=!a?'unassigned':a.status==='draft'?'draft':'confirmed';return<button type="button" key={row.id} className={`schedule-person ${selected?.id===row.id?'active':''}`} onClick={()=>setSelectedId(row.id)}><div><strong>{participantName(row)}</strong><span>{row.contact_email||row.contact_phone||'연락처 없음'}</span></div><em className={`schedule-state ${state}`}>{state==='unassigned'?'미배정':state==='draft'?'미확정':'확정'}</em></button>})}</div></aside>
      <main className="schedule-v2-main">{selected&&activeField&&<><div className={`schedule-next-action ${!currentAssignment?'unassigned':currentAssignment.status==='draft'?'draft':'confirmed'}`}><div className="schedule-next-copy"><span className="schedule-next-label">{participantName(selected)} · {activeField.sessionLabel||activeField.label}</span>{!currentAssignment?<><strong>가능한 시간 하나를 선택하세요.</strong><small>강조된 셀만 선택할 수 있습니다.</small></>:currentAssignment.status==='draft'?<><strong>{fmtDateTime(currentAssignment.starts_at)} · 미확정</strong><small>시간이 맞으면 확정하세요. 다른 셀을 누르면 시간이 변경됩니다.</small></>:<><strong>{fmtDateTime(currentAssignment.starts_at)} · 확정</strong><small>참가자에게 안내할 최종 일정입니다.</small></>}</div><div className="schedule-next-actions">{currentAssignment?.status==='draft'&&<button className="btn" disabled={busy} onClick={()=>confirmAssignment(currentAssignment)}>이 시간으로 확정</button>}{currentAssignment?.status==='confirmed'&&<button className="btn secondary" disabled={busy} onClick={()=>unconfirmAssignment(currentAssignment)}>확정 취소</button>}{currentAssignment&&<button className="btn ghost" disabled={busy} onClick={()=>removeAssignment(currentAssignment)}>배정 취소</button>}</div></div>{renderGrid(false)}</>}</main>
    </div>:<div className="bulk-layout">
      <aside className="bulk-queue card"><div className="bulk-queue-head"><div><h3>배정 대기</h3><span className="muted small">미배정 참가자부터 표시됩니다.</span></div><span className="pill state-unassigned">{statusCounts.unassigned}명</span></div><div className="bulk-person-list">{orderedResponses.map(row=>{const a=activeField?participantSessionAssignment(row,activeField):null;const state=!a?'unassigned':a.status==='draft'?'draft':'confirmed';return<button type="button" key={row.id} className={`bulk-person ${selected?.id===row.id?'active':''}`} onClick={()=>setSelectedId(row.id)}><div><strong>{participantName(row)}</strong><span>{a?`${stateLabel(a.status)} · ${fmtDateTime(a.starts_at)}`:`가능 시간 ${(activeField&&row.availability?.[activeField.id]?.length)||0}개`}</span></div><em className={`schedule-state ${state}`}>{state==='unassigned'?'미배정':state==='draft'?'미확정':'확정'}</em></button>})}</div></aside>
      <main><div className="bulk-toolbar"><div><h3>{selected?`${participantName(selected)} 배치`:'참가자를 선택하세요'}</h3><p className="muted small">사람을 고른 뒤 강조된 시간 셀을 누르면 미확정 배정되고, 다음 미배정 참가자가 자동 선택됩니다.</p></div></div>{renderGrid(true)}{draftAssignments.length>0&&<div className="bulk-draft-bar"><strong>미확정 일정 {draftAssignments.length}건이 남아 있습니다.</strong><button className="btn" disabled={busy} onClick={confirmAllDrafts}>미확정 전체 확정</button></div>}</main>
    </div>}

    {activeField&&<section className="schedule-v2-summary card"><div className="schedule-pane-title"><div><h3>이 세션의 전체 일정</h3><p className="muted small">상태를 빠르게 검토합니다.</p></div><span>{sessionAssignments.length}건</span></div><div className="schedule-summary-list">{sessionAssignments.map(a=><div className="schedule-summary-row" key={a.id}><strong>{participantNameById(a.response_id)}</strong><span>{fmtDateTime(a.starts_at)}</span><em className={`schedule-state ${a.status==='draft'?'draft':'confirmed'}`}>{a.status==='draft'?'미확정':'확정'}</em></div>)}{!sessionAssignments.length&&<div className="empty compact">아직 배정된 일정이 없습니다.</div>}</div></section>}
  </div>
}
