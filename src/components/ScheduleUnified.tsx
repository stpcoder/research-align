'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FormField, ResponseRow, Study } from '@/lib/types'
import {
  AdminListItem,
  AdminPageHeader,
  AdminPanelHeader,
  AdminSplitView,
  AdminSurface,
  SegmentedControl,
  StatusBadge,
} from '@/components/admin/AdminUI'
import { useGoogleCalendar } from '@/components/useGoogleCalendar'

type Assignment={id:string;study_id:string;response_id:string;session_key:string;session_label:string;starts_at:string;ends_at:string;status:'draft'|'confirmed'|'completed'|'cancelled'}
type Mode='person'|'bulk'
type Range={start:string;end:string}

const fmtDateTime=(iso:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))
const fmtDay=(day:string)=>new Date(`${day}T00:00:00+09:00`).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric',weekday:'short'})
function kstSlot(iso:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso));const get=(t:string)=>parts.find(p=>p.type===t)?.value||'';return`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`}
function buildTimelineTimes(field:FormField){const[start,end]=(field.hours||'10:00-18:00').split('-');const[sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number);const step=Math.max(5,field.stepMinutes||30);const out:string[]=[];for(let m=sh*60+sm;m<eh*60+em;m+=step)out.push(`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`);return out}
function assignmentState(a:Assignment|null){if(!a)return'unassigned' as const;if(a.status==='draft')return'draft' as const;if(a.status==='completed')return'completed' as const;return'confirmed' as const}
function assignmentLabel(a:Assignment){if(a.status==='draft')return'미확정';if(a.status==='completed')return'완료';return'확정'}
function overlaps(range:Range,start:number,end:number){return start<new Date(range.end).getTime()&&end>new Date(range.start).getTime()}

export default function ScheduleUnified({study}:{study:Study}){
  const[responses,setResponses]=useState<ResponseRow[]>([])
  const[assignments,setAssignments]=useState<Assignment[]>([])
  const[selectedId,setSelectedId]=useState('')
  const[activeSessionKey,setActiveSessionKey]=useState('')
  const[mode,setMode]=useState<Mode>('person')
  const[busy,setBusy]=useState(false)
  const calendar=useGoogleCalendar(study.id)

  const rawFields=useMemo(()=>study.form_config.fields.filter(f=>f.type==='availability'),[study.form_config.fields])
  const configuredOrder=(study.scheduling_config?.sessionOrder as string[]|undefined)||[]
  const sessionKey=(field:FormField)=>field.sessionKey||field.id
  const fields=useMemo(()=>{
    const ordered=configuredOrder.map(k=>rawFields.find(f=>sessionKey(f)===k)).filter(Boolean) as FormField[]
    const remaining=rawFields.filter(f=>!configuredOrder.includes(sessionKey(f)))
    return[...ordered,...remaining]
  },[rawFields,configuredOrder.join('|')])
  const nameField=useMemo(()=>study.form_config.fields.find(f=>f.type==='short'&&/이름|name/i.test(f.label))||study.form_config.fields.find(f=>f.type==='short'),[study.form_config.fields])
  const selected=responses.find(r=>r.id===selectedId)||responses[0]||null
  const activeField=fields.find(f=>sessionKey(f)===activeSessionKey)||fields[0]||null
  const maxPerDay=Number(study.scheduling_config?.maxSessionsPerDay||0)

  function participantName(row:ResponseRow){if(nameField){const value=row.answers?.[nameField.id];if(typeof value==='string'&&value.trim())return value}return row.contact_email||row.contact_phone||'참가자'}
  function participantNameById(id:string){const row=responses.find(r=>r.id===id);return row?participantName(row):'참가자'}
  function assignmentFor(row:ResponseRow,field:FormField){return assignments.find(a=>a.response_id===row.id&&a.session_key===sessionKey(field)&&a.status!=='cancelled')||null}

  async function load(){
    const[{data:r},{data:a}]=await Promise.all([
      supabase.from('responses').select('*').eq('study_id',study.id).order('submitted_at'),
      supabase.from('assignments').select('*').eq('study_id',study.id).order('starts_at'),
    ])
    const nextResponses=(r||[]) as ResponseRow[]
    setResponses(nextResponses);setAssignments((a||[]) as Assignment[])
    setSelectedId(current=>current&&nextResponses.some(row=>row.id===current)?current:nextResponses[0]?.id||'')
    setActiveSessionKey(current=>current&&fields.some(f=>sessionKey(f)===current)?current:fields[0]?sessionKey(fields[0]):'')
  }
  useEffect(()=>{load()},[study.id])

  function firstActionableField(row:ResponseRow){return fields.find(field=>{const a=assignmentFor(row,field);return!a||a.status==='draft'})||fields[0]||null}
  function selectParticipant(id:string){setSelectedId(id);const row=responses.find(r=>r.id===id);const next=row?firstActionableField(row):null;if(next)setActiveSessionKey(sessionKey(next))}

  const dates=useMemo(()=>{
    if(!activeField)return[]
    if(activeField.dates?.length)return activeField.dates
    const set=new Set<string>();for(const response of responses)for(const slot of response.availability?.[activeField.id]||[])set.add(slot.split('T')[0]);return[...set].sort()
  },[activeField,responses])
  const times=useMemo(()=>activeField?buildTimelineTimes(activeField):[],[activeField])

  useEffect(()=>{
    if(!calendar.status.connected||!dates.length)return
    const first=new Date(`${dates[0]}T00:00:00+09:00`)
    const last=new Date(`${dates[dates.length-1]}T23:59:59+09:00`)
    calendar.refreshBusy(first.toISOString(),last.toISOString())
  },[calendar.status.connected,activeField?.id,dates.join('|')])

  function calendarBlocks(start:number,end:number){return calendar.busy.some(item=>overlaps(item,start,end))}
  function rankFor(row:ResponseRow,field:FormField,slot:string){const pref=row.preferences?.[field.id]||{};const found=Object.entries(pref).find(([,value])=>value===slot);return found?Number(found[0]):0}
  function otherAvailabilityCount(field:FormField,slot:string,rowId:string){return responses.reduce((count,row)=>count+(row.id!==rowId&&(row.availability?.[field.id]||[]).includes(slot)?1:0),0)}
  function cellInterval(slot:string,field:FormField){const start=new Date(`${slot}:00+09:00`).getTime();return{start,end:start+(field.stepMinutes||30)*60_000}}
  function assignmentCoveringCell(slot:string,field:FormField){const cell=cellInterval(slot,field);return assignments.find(a=>{if(a.status==='cancelled')return false;const start=new Date(a.starts_at).getTime(),end=new Date(a.ends_at).getTime();return cell.start<end&&cell.end>start})||null}
  function startsInCell(a:Assignment,slot:string,field:FormField){const cell=cellInterval(slot,field),start=new Date(a.starts_at).getTime();return start>=cell.start&&start<cell.end}
  function priorMissing(row:ResponseRow,field:FormField){const index=fields.findIndex(f=>f.id===field.id);if(index<=0)return null;for(const prior of fields.slice(0,index))if(!assignmentFor(row,prior))return prior;return null}

  function participantPlan(row:ResponseRow){const total=fields.length;let confirmed=0,draft=0,assigned=0;for(const field of fields){const a=assignmentFor(row,field);if(a)assigned++;if(a?.status==='draft')draft++;if(a&&a.status!=='draft'&&a.status!=='cancelled')confirmed++}return{total,confirmed,draft,assigned}}
  function stageProgress(field:FormField){let confirmed=0,draft=0;for(const row of responses){const a=assignmentFor(row,field);if(a?.status==='draft')draft++;else if(a)confirmed++}return{confirmed,draft,unassigned:Math.max(0,responses.length-confirmed-draft)}}
  const orderedPeople=useMemo(()=>[...responses].sort((a,b)=>{const ap=participantPlan(a),bp=participantPlan(b);const ar=ap.confirmed===ap.total?2:ap.draft?1:0,br=bp.confirmed===bp.total?2:bp.draft?1:0;return ar-br||participantName(a).localeCompare(participantName(b),'ko')}),[responses,assignments,fields])
  const currentAssignment=selected&&activeField?assignmentFor(selected,activeField):null
  const missingPrior=selected&&activeField?priorMissing(selected,activeField):null

  async function assign(field:FormField,slot:string){
    if(!selected||busy)return
    if(!(selected.availability?.[field.id]||[]).includes(slot))return
    const missing=priorMissing(selected,field);if(missing){alert(`${missing.sessionLabel||missing.label} 일정을 먼저 배정해주세요.`);return}
    const session=sessionKey(field),start=new Date(`${slot}:00+09:00`),end=new Date(start.getTime()+(field.duration||60)*60_000)
    if(calendarBlocks(start.getTime(),end.getTime())){alert('Google Calendar의 기존 일정과 겹칩니다. 다른 시간을 선택해주세요.');return}
    const existing=assignmentFor(selected,field);if(existing?.status==='confirmed'&&!confirm('이미 확정된 일정입니다. 시간을 변경하면 다시 미확정 상태가 됩니다. 변경할까요?'))return
    const conflict=assignments.find(a=>{if(a.status==='cancelled')return false;if(a.response_id===selected.id&&a.session_key===session)return false;const s=new Date(a.starts_at).getTime(),e=new Date(a.ends_at).getTime();return start.getTime()<e&&end.getTime()>s})
    if(conflict){alert(`${participantNameById(conflict.response_id)} 참가자의 ${conflict.session_label} 일정과 겹칩니다.`);return}
    if(maxPerDay>0){const date=slot.split('T')[0];const sameDay=assignments.filter(a=>a.response_id===selected.id&&a.status!=='cancelled'&&a.session_key!==session&&kstSlot(a.starts_at).startsWith(date)).length;if(sameDay>=maxPerDay){alert(`이 참가자는 하루에 최대 ${maxPerDay}개 세션만 배정할 수 있습니다.`);return}}
    const bulkCandidates=mode==='bulk'?orderedPeople.filter(row=>row.id!==selected.id&&!assignmentFor(row,field)&&!priorMissing(row,field)&&(row.availability?.[field.id]||[]).length>0):[]
    setBusy(true)
    const{error}=await supabase.from('assignments').upsert({study_id:study.id,response_id:selected.id,session_key:session,session_label:field.sessionLabel||field.label,starts_at:start.toISOString(),ends_at:end.toISOString(),status:'draft'},{onConflict:'response_id,session_key'})
    setBusy(false);if(error)alert(error.message);else{await load();if(mode==='bulk'&&bulkCandidates[0])setSelectedId(bulkCandidates[0].id)}
  }
  async function confirmAssignment(a:Assignment){setBusy(true);const{error}=await supabase.from('assignments').update({status:'confirmed'}).eq('id',a.id);setBusy(false);if(error)alert(error.message);else{await load();if(selected){const index=fields.findIndex(f=>f.id===activeField?.id);const next=fields.slice(index+1).find(field=>!assignmentFor(selected,field)||assignmentFor(selected,field)?.status==='draft');if(next)setActiveSessionKey(sessionKey(next))}}}
  async function unconfirmAssignment(a:Assignment){await supabase.from('assignments').update({status:'draft'}).eq('id',a.id);await load()}
  async function removeAssignment(a:Assignment){if(!confirm(`${participantNameById(a.response_id)} 참가자의 ${a.session_label} 배정을 취소할까요?`))return;await supabase.from('assignments').delete().eq('id',a.id);await load()}
  async function confirmAllDrafts(){if(!activeField)return;const ids=assignments.filter(a=>a.session_key===sessionKey(activeField)&&a.status==='draft').map(a=>a.id);if(!ids.length)return;if(!confirm(`${ids.length}개의 미확정 일정을 모두 확정할까요?`))return;setBusy(true);const{error}=await supabase.from('assignments').update({status:'confirmed'}).in('id',ids);setBusy(false);if(error)alert(error.message);else await load()}

  if(!fields.length)return<div className="empty">신청서에 시간 선택 문항을 먼저 추가해주세요.</div>

  const participantSidebar=<AdminSurface><AdminPanelHeader title="참가자" meta={`${responses.length}명`} description="전체 세션 진행 상태를 기준으로 정렬됩니다."/><div className="aui-list">{orderedPeople.map(row=>{const plan=participantPlan(row),allDone=plan.total>0&&plan.confirmed===plan.total,status=allDone?'confirmed':plan.draft?'draft':'unassigned',label=allDone?`${plan.total}/${plan.total} 확정`:`${plan.confirmed}/${plan.total} 확정${plan.draft?` · ${plan.draft} 미확정`:''}`;return<AdminListItem key={row.id} active={selected?.id===row.id} title={participantName(row)} subtitle={row.contact_email||row.contact_phone||'연락처 없음'} status={<StatusBadge status={status} label={label}/>} onClick={()=>selectParticipant(row.id)}/>})}</div></AdminSurface>

  const sessionPlan=()=> <AdminSurface className="sp-plan"><AdminPanelHeader title={mode==='person'?'전체 세션 플랜':'배정할 세션'} meta={`${fields.length}개`} description={mode==='person'?'각 단계의 상태를 한 번에 보고, 배정할 단계를 선택합니다.':'세션을 바꾸면 전체 배정 큐와 타임테이블이 함께 바뀝니다.'}/><div className="sp-stage-grid">{fields.map((field,index)=>{const active=activeField?.id===field.id,a=selected?assignmentFor(selected,field):null,global=stageProgress(field),state=mode==='person'?assignmentState(a):global.confirmed===responses.length&&responses.length>0?'confirmed':global.draft?'draft':'unassigned',label=mode==='person'?a?`${assignmentLabel(a)} · ${fmtDateTime(a.starts_at)}`:'미배정':`확정 ${global.confirmed}/${responses.length}${global.draft?` · 미확정 ${global.draft}`:''}`;return<button type="button" key={field.id} className={`sp-stage ${active?'active':''}`} onClick={()=>setActiveSessionKey(sessionKey(field))}><span className="sp-stage-index">{index+1}</span><span className="sp-stage-copy"><strong>{field.sessionLabel||field.label}</strong><small>{field.duration||60}분</small><em>{label}</em></span><StatusBadge status={state}/></button>})}</div></AdminSurface>

  const renderGrid=()=>{
    if(!selected||!activeField)return<AdminSurface><div className="empty">참가자를 선택하세요.</div></AdminSurface>
    const selectedName=participantName(selected)
    return<AdminSurface className="sp-grid-panel"><div className="sp-grid-head"><div><h3>{activeField.sessionLabel||activeField.label} 타임테이블</h3><p>선택한 참가자의 가능 시간, StudyForm 배정, Google Calendar의 관리자 busy 시간을 함께 보여줍니다.</p></div><div className="sp-legend"><span><i className="preferred"/> {selectedName} 선호</span><span><i className="available"/> {selectedName} 가능</span><span><i className="draft"/> {selectedName} 미확정</span><span><i className="confirmed"/> {selectedName} 확정</span><span><i className="occupied"/> 다른 참가자 예약</span><span><i className="google"/> 내 Google 일정</span></div></div>
      <div className="sp-grid-scroll"><div className="sp-grid" style={{gridTemplateColumns:`78px repeat(${Math.max(dates.length,1)}, minmax(172px,1fr))`}}><div className="sp-corner">시간</div>{dates.map(day=><div className="sp-date" key={day}>{fmtDay(day)}</div>)}{times.flatMap(time=>[<div className="sp-time" key={`time-${time}`}>{time}</div>,...dates.map(day=>{const slot=`${day}T${time}`,available=(selected.availability?.[activeField.id]||[]).includes(slot),rank=rankFor(selected,activeField,slot),others=otherAvailabilityCount(activeField,slot,selected.id),covering=assignmentCoveringCell(slot,activeField),ownCurrent=!!covering&&covering.response_id===selected.id&&covering.session_key===sessionKey(activeField),startsHere=covering?startsInCell(covering,slot,activeField):false,cell=cellInterval(slot,activeField),googleBusy=!covering&&calendarBlocks(cell.start,cell.end),state=covering?ownCurrent?covering.status==='draft'?'own-draft':'own-confirmed':'occupied':googleBusy?'google-busy':available?rank>0?'preferred':'available':'empty',canAssign=!missingPrior&&!covering&&!googleBusy&&available&&!busy;return<button type="button" key={slot} className={`sp-cell ${state}`} disabled={!canAssign} onClick={()=>assign(activeField,slot)}>{covering?ownCurrent?<><span className="sp-cell-top">{assignmentLabel(covering)}</span><strong>{startsHere?`${selectedName} · ${covering.session_label}`:'내 일정 진행 중'}</strong><small>{startsHere?fmtDateTime(covering.starts_at):'이 시간은 이미 내 일정에 포함됩니다.'}</small></>:<><span className="sp-cell-top">예약됨</span><strong>{startsHere?`${participantNameById(covering.response_id)} · ${covering.session_label}`:'다른 일정 진행 중'}</strong><small>{assignmentLabel(covering)}{available?` · ${selectedName}${rank?` ${rank}순위`:'도 가능'}`:''}</small></>:googleBusy?<><span className="sp-cell-top">내 Google 일정</span><strong>관리자 일정과 겹침</strong><small>{available?`${selectedName}${rank?` ${rank}순위`:'도 가능'} · 배정 불가`:'배정 불가'}</small></>:<><span className="sp-cell-top">비어 있음</span><strong>{available?(rank?`${selectedName} · ${rank}순위`:`${selectedName} · 가능`):`${selectedName} · 선택 안 함`}</strong>{others>0?<small>다른 참가자 {others}명도 가능</small>:<small>다른 참가자 선택 없음</small>}</>}</button>})])}</div></div>
    </AdminSurface>
  }

  const personMode=()=> <AdminSplitView sidebar={participantSidebar} sidebarWidth={300}><div className="sp-main-stack">{sessionPlan()}{selected&&activeField&&<div className={`sp-action ${missingPrior?'blocked':!currentAssignment?'unassigned':currentAssignment.status==='draft'?'draft':'confirmed'}`}><div><small>{participantName(selected)} · {activeField.sessionLabel||activeField.label}</small>{missingPrior?<><strong>{missingPrior.sessionLabel||missingPrior.label}을 먼저 배정해주세요.</strong><span>세션 순서 제약 때문에 현재 단계는 아직 배정할 수 없습니다.</span></>:!currentAssignment?<><strong>이 단계의 시간을 선택하세요.</strong><span>참가자가 선택했고, StudyForm과 Google Calendar 모두 비어 있는 시간만 배정할 수 있습니다.</span></>:currentAssignment.status==='draft'?<><strong>{fmtDateTime(currentAssignment.starts_at)} · 미확정</strong><span>시간이 맞으면 확정하거나 다른 빈 셀을 선택해 변경할 수 있습니다.</span></>:<><strong>{fmtDateTime(currentAssignment.starts_at)} · 확정</strong><span>선택한 참가자의 최종 일정입니다.</span></>}</div><div className="sp-action-buttons">{missingPrior&&<button className="btn secondary" onClick={()=>setActiveSessionKey(sessionKey(missingPrior))}>이전 단계로 이동</button>}{currentAssignment?.status==='draft'&&<button className="btn" disabled={busy} onClick={()=>confirmAssignment(currentAssignment)}>이 시간으로 확정</button>}{currentAssignment?.status==='confirmed'&&<button className="btn secondary" disabled={busy} onClick={()=>unconfirmAssignment(currentAssignment)}>확정 취소</button>}{currentAssignment&&<button className="btn ghost" disabled={busy} onClick={()=>removeAssignment(currentAssignment)}>배정 취소</button>}</div></div>}{renderGrid()}</div></AdminSplitView>

  const bulkRows=activeField?orderedPeople.filter(row=>!assignmentFor(row,activeField)||assignmentFor(row,activeField)?.status==='draft'):[]
  const bulkSidebar=<AdminSurface><AdminPanelHeader title="배정 대기" meta={`${bulkRows.length}명`} description="현재 선택한 세션에서 아직 확정되지 않은 참가자입니다."/><div className="aui-list">{bulkRows.map(row=>{const a=activeField?assignmentFor(row,activeField):null,prior=activeField?priorMissing(row,activeField):null,slots=activeField?(row.availability?.[activeField.id]||[]).length:0;return<AdminListItem key={row.id} active={selected?.id===row.id} title={participantName(row)} subtitle={`${slots}개 시간 선택${prior?` · ${prior.sessionLabel||prior.label} 먼저 필요`:''}`} status={<StatusBadge status={prior?'neutral':assignmentState(a)} label={prior?'이전 단계 필요':undefined}/>} onClick={()=>setSelectedId(row.id)}/>})}</div></AdminSurface>
  const bulkMode=()=> <div className="sp-main-stack">{sessionPlan()}<AdminSplitView sidebar={bulkSidebar} sidebarWidth={300}><div className="sp-main-stack">{selected&&activeField&&<div className="sp-bulk-head"><div><strong>{participantName(selected)}</strong><span>{activeField.sessionLabel||activeField.label} · 선택 시간 {(selected.availability?.[activeField.id]||[]).length}개</span></div><div className="sp-bulk-actions">{assignments.some(a=>a.session_key===sessionKey(activeField)&&a.status==='draft')&&<button className="btn" disabled={busy} onClick={confirmAllDrafts}>이 세션 미확정 전체 확정</button>}</div></div>}{renderGrid()}</div></AdminSplitView></div>

  const calendarControl=<div className="sp-head-controls"><SegmentedControl value={mode} options={[{value:'person',label:'참가자별 배정'},{value:'bulk',label:'전체 배정'}]} onChange={value=>setMode(value as Mode)}/>{!calendar.status.configured?<button className="btn secondary small" disabled title={calendar.status.redirect_uri||''}>Google Calendar 설정 필요</button>:!calendar.status.connected?<button className="btn secondary small" disabled={calendar.loading} onClick={()=>calendar.connect()}>{calendar.loading?'연결 중…':'Google Calendar 연결'}</button>:<><span className="sp-google-connected">Google 일정 반영됨</span><button className="btn secondary small" disabled={calendar.loading||!dates.length} onClick={()=>{if(dates.length){const first=new Date(`${dates[0]}T00:00:00+09:00`),last=new Date(`${dates[dates.length-1]}T23:59:59+09:00`);calendar.refreshBusy(first.toISOString(),last.toISOString())}}}>새로고침</button><button className="btn ghost small" onClick={()=>calendar.disconnect()}>연결 해제</button></>}</div>

  return<div className="sp-root"><AdminPageHeader kicker="SCHEDULE" title="일정 배정" description="참가자의 전체 세션, StudyForm 예약, 관리자의 Google Calendar busy 시간을 한 화면에서 조율합니다." actions={calendarControl}/>{calendar.error&&<div className="notice">{calendar.error}</div>}{mode==='person'?personMode():bulkMode()}</div>
}
