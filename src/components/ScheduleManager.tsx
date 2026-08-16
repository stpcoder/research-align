'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FormField, ResponseRow, Study } from '@/lib/types'

type Assignment = {
  id: string
  study_id: string
  response_id: string
  session_key: string
  session_label: string
  starts_at: string
  ends_at: string
  status: 'draft' | 'confirmed' | 'completed' | 'cancelled'
}

const fmtDateTime = (iso:string) => new Intl.DateTimeFormat('ko-KR', {
  timeZone:'Asia/Seoul', month:'long', day:'numeric', weekday:'short', hour:'2-digit', minute:'2-digit'
}).format(new Date(iso))

const fmtDay = (day:string) => new Date(`${day}T00:00:00+09:00`).toLocaleDateString('ko-KR', {
  month:'numeric', day:'numeric', weekday:'short'
})

function kstSlot(iso:string) {
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(iso))
  const get=(type:string)=>parts.find(p=>p.type===type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

function buildTimes(field:FormField) {
  const [start,end]=(field.hours||'10:00-18:00').split('-')
  const [sh,sm]=start.split(':').map(Number)
  const [eh,em]=end.split(':').map(Number)
  const step=field.stepMinutes||30
  const duration=field.duration||60
  const result:string[]=[]
  for (let minute=sh*60+sm; minute+duration<=eh*60+em; minute+=step) {
    result.push(`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`)
  }
  return result
}

export default function ScheduleManager({study}:{study:Study}) {
  const [responses,setResponses] = useState<ResponseRow[]>([])
  const [assignments,setAssignments] = useState<Assignment[]>([])
  const [selectedId,setSelectedId] = useState('')
  const [sessionKey,setSessionKey] = useState('')
  const [busy,setBusy] = useState(false)

  const fields = useMemo(()=>study.form_config.fields.filter(f=>f.type==='availability'),[study.form_config.fields])
  const nameField = useMemo(
    () => study.form_config.fields.find(f=>f.type==='short' && /이름|name/i.test(f.label))
      || study.form_config.fields.find(f=>f.type==='short'),
    [study.form_config.fields]
  )
  const activeField = fields.find(f=>(f.sessionKey||f.id)===sessionKey) || fields[0] || null
  const selected = responses.find(r=>r.id===selectedId) || responses[0] || null
  const sessionOrder=(study.scheduling_config?.sessionOrder as string[]|undefined) || fields.map(f=>f.sessionKey||f.id)
  const maxPerDay=Number(study.scheduling_config?.maxSessionsPerDay||0)

  const dates = useMemo(()=>{
    if (!activeField) return []
    if (activeField.dates?.length) return activeField.dates
    const set=new Set<string>()
    for (const response of responses) for (const slot of response.availability?.[activeField.id]||[]) set.add(slot.split('T')[0])
    return [...set].sort()
  },[activeField,responses])
  const times = useMemo(()=>activeField ? buildTimes(activeField) : [],[activeField])

  function participantName(row:ResponseRow) {
    if (nameField) {
      const value=row.answers?.[nameField.id]
      if (typeof value==='string' && value.trim()) return value
    }
    return row.contact_email || row.contact_phone || '참가자'
  }

  function participantNameById(id:string) {
    const row=responses.find(r=>r.id===id)
    return row ? participantName(row) : '참가자'
  }

  async function load() {
    const [{data:r},{data:a}]=await Promise.all([
      supabase.from('responses').select('*').eq('study_id',study.id).order('submitted_at'),
      supabase.from('assignments').select('*').eq('study_id',study.id).order('starts_at'),
    ])
    const next=(r||[]) as ResponseRow[]
    setResponses(next)
    setAssignments((a||[]) as Assignment[])
    setSelectedId(current=>current || next[0]?.id || '')
    setSessionKey(current=>current || fields[0]?.sessionKey || fields[0]?.id || '')
  }

  useEffect(()=>{ load() },[study.id])

  function rankFor(row:ResponseRow,field:FormField,slot:string) {
    const pref=row.preferences?.[field.id] || {}
    const found=Object.entries(pref).find(([,value])=>value===slot)
    return found ? Number(found[0]) : 0
  }

  function availableCount(field:FormField,slot:string) {
    return responses.reduce((count,row)=>count+((row.availability?.[field.id]||[]).includes(slot)?1:0),0)
  }

  function assignmentForSlot(field:FormField,slot:string) {
    const key=field.sessionKey||field.id
    return assignments.find(a=>a.session_key===key && a.status!=='cancelled' && kstSlot(a.starts_at)===slot) || null
  }

  function participantSessionAssignment(row:ResponseRow,field:FormField) {
    const key=field.sessionKey||field.id
    return assignments.find(a=>a.response_id===row.id && a.session_key===key && a.status!=='cancelled') || null
  }

  async function assign(field:FormField,slot:string) {
    if (!selected || busy) return
    const session=field.sessionKey||field.id
    const selectedSlots=selected.availability?.[field.id] || []
    if (!selectedSlots.includes(slot)) return

    const start=new Date(`${slot}:00+09:00`)
    const end=new Date(start.getTime()+(field.duration||60)*60_000)

    const overlap=assignments.find(a=>{
      if (a.status==='cancelled') return false
      if (a.response_id===selected.id && a.session_key===session) return false
      const aStart=new Date(a.starts_at).getTime()
      const aEnd=new Date(a.ends_at).getTime()
      return start.getTime()<aEnd && end.getTime()>aStart
    })
    if (overlap) {
      alert(`${participantNameById(overlap.response_id)} 참가자의 기존 일정과 겹칩니다.`)
      return
    }

    if (maxPerDay>0) {
      const date=slot.split('T')[0]
      const sameDay=assignments.filter(a=>a.response_id===selected.id && a.status!=='cancelled' && a.session_key!==session && kstSlot(a.starts_at).startsWith(date)).length
      if (sameDay>=maxPerDay) {
        alert(`이 참가자는 하루에 최대 ${maxPerDay}개 세션만 배정할 수 있습니다.`)
        return
      }
    }

    const orderIndex=sessionOrder.indexOf(session)
    if (orderIndex>0) {
      const missing=sessionOrder.slice(0,orderIndex).find(key=>!assignments.some(a=>a.response_id===selected.id && a.session_key===key && a.status!=='cancelled'))
      if (missing) {
        const prior=fields.find(f=>(f.sessionKey||f.id)===missing)
        alert(`${prior?.sessionLabel||'이전 세션'} 일정을 먼저 배정해주세요.`)
        return
      }
    }

    setBusy(true)
    const {error}=await supabase.from('assignments').upsert({
      study_id:study.id,
      response_id:selected.id,
      session_key:session,
      session_label:field.sessionLabel||field.label,
      starts_at:start.toISOString(),
      ends_at:end.toISOString(),
      status:'draft',
    },{onConflict:'response_id,session_key'})
    setBusy(false)
    if (error) alert(error.message)
    else await load()
  }

  async function toggleConfirm(a:Assignment) {
    await supabase.from('assignments').update({status:a.status==='confirmed'?'draft':'confirmed'}).eq('id',a.id)
    await load()
  }

  async function removeAssignment(a:Assignment) {
    if (!confirm(`${participantNameById(a.response_id)} 참가자의 ${a.session_label} 일정을 삭제할까요?`)) return
    await supabase.from('assignments').delete().eq('id',a.id)
    await load()
  }

  const sessionAssignments=activeField
    ? assignments.filter(a=>a.session_key===(activeField.sessionKey||activeField.id) && a.status!=='cancelled')
    : []

  return <div className="schedule-workspace timetable-workspace">
    <div className="schedule-overview">
      <div>
        <h2>일정 배정</h2>
        <p className="muted">참가자를 선택하면 그 사람이 신청한 시간과 선호 순위가 타임테이블에 표시됩니다.</p>
      </div>
      <div className="schedule-summary muted small">신청자 {responses.length}명 · 전체 배정 {assignments.length}건 · 확정 {assignments.filter(a=>a.status==='confirmed').length}건</div>
    </div>

    <div className="session-switcher" role="tablist" aria-label="세션 선택">
      {fields.map(field=>{
        const key=field.sessionKey||field.id
        return <button type="button" className={`session-tab ${activeField?.id===field.id?'active':''}`} key={field.id} onClick={()=>setSessionKey(key)}>
          <strong>{field.sessionLabel||field.label}</strong>
          <span>{field.duration||60}분</span>
        </button>
      })}
    </div>

    <div className="timetable-layout">
      <aside className="card timetable-participants">
        <div className="section-head">
          <h3>참가자</h3>
          <span className="muted small">한 명을 선택하세요</span>
        </div>
        <div className="people timetable-people">
          {responses.map(row=>{
            const assignment=activeField ? participantSessionAssignment(row,activeField) : null
            return <button type="button" key={row.id} className={`person ${selected?.id===row.id?'active':''}`} onClick={()=>setSelectedId(row.id)}>
              <strong>{participantName(row)}</strong>
              <span className="muted small">{row.contact_email || row.contact_phone || '연락처 없음'}</span>
              <span className="participant-schedule-state">
                {!assignment ? '미배정' : assignment.status==='confirmed' ? `확정 · ${fmtDateTime(assignment.starts_at)}` : `미확정 · ${fmtDateTime(assignment.starts_at)}`}
              </span>
            </button>
          })}
          {!responses.length&&<div className="empty compact">아직 신청자가 없습니다.</div>}
        </div>
      </aside>

      <section className="card timetable-panel">
        {!activeField || !selected ? <div className="empty">참가자와 세션을 선택하세요.</div> : <>
          <div className="timetable-head">
            <div>
              <h2>{participantName(selected)}</h2>
              <div className="response-meta">
                <span>{activeField.sessionLabel||activeField.label}</span>
                <span>소요 시간 {activeField.duration||60}분</span>
                <span>신청한 시간 {(selected.availability?.[activeField.id]||[]).length}개</span>
              </div>
            </div>
            <div className="timetable-legend">
              <span><i className="legend-swatch preferred"/>선호 시간</span>
              <span><i className="legend-swatch available"/>가능 시간</span>
              <span><i className="legend-swatch assigned"/>이미 배정됨</span>
            </div>
          </div>

          <div className="timetable-scroll">
            <div className="timetable-grid" style={{gridTemplateColumns:`74px repeat(${Math.max(dates.length,1)}, minmax(150px,1fr))`}}>
              <div className="timetable-corner">시간</div>
              {dates.map(day=><div className="timetable-date" key={day}>{fmtDay(day)}</div>)}
              {times.map(time=>[
                <div className="timetable-time" key={`time-${time}`}>{time}</div>,
                ...dates.map(day=>{
                  const slot=`${day}T${time}`
                  const available=(selected.availability?.[activeField.id]||[]).includes(slot)
                  const rank=rankFor(selected,activeField,slot)
                  const occupant=assignmentForSlot(activeField,slot)
                  const mine=occupant?.response_id===selected.id
                  const count=availableCount(activeField,slot)
                  const disabled=busy || (!!occupant && !mine) || (!available && !mine)
                  const className=['timetable-cell',available?'available':'',rank>0?'preferred':'',occupant?'assigned':'',mine?'mine':''].filter(Boolean).join(' ')
                  return <button type="button" key={slot} className={className} disabled={disabled} onClick={()=>assign(activeField,slot)}>
                    {occupant ? <>
                      <strong>{participantNameById(occupant.response_id)}</strong>
                      <span>{occupant.status==='confirmed'?'확정':'미확정'}</span>
                    </> : available ? <>
                      <strong>{rank>0 ? `${rank}순위` : '가능'}</strong>
                      <span>{count>1 ? `이 시간 가능 ${count}명` : '클릭하여 배정'}</span>
                    </> : <span className="cell-count">{count>0 ? `${count}명 가능` : '—'}</span>}
                  </button>
                })
              ])}
            </div>
          </div>
        </>}
      </section>
    </div>

    {activeField&&<section className="card schedule-current">
      <div className="section-head">
        <div>
          <h3>{activeField.sessionLabel||activeField.label} 배정 현황</h3>
          <p className="muted small">타임테이블에서 배정한 뒤 검토하고 ‘일정 확정’을 누르세요.</p>
        </div>
      </div>
      <div className="schedule-table">
        <div className="schedule-table-head"><span>참가자</span><span>일시</span><span>상태</span><span>관리</span></div>
        {sessionAssignments.map(a=><div className="schedule-table-row compact-grid" key={a.id}>
          <strong>{participantNameById(a.response_id)}</strong>
          <span>{fmtDateTime(a.starts_at)}</span>
          <span><span className={`pill ${a.status==='confirmed'?'live':''}`}>{a.status==='confirmed'?'확정':a.status==='completed'?'완료':'미확정'}</span></span>
          <div className="row schedule-actions">
            <button className="btn secondary small" onClick={()=>toggleConfirm(a)}>{a.status==='confirmed'?'확정 취소':'일정 확정'}</button>
            <button className="btn danger small" onClick={()=>removeAssignment(a)}>삭제</button>
          </div>
        </div>)}
        {!sessionAssignments.length&&<div className="empty compact">이 세션에 아직 배정된 일정이 없습니다.</div>}
      </div>
    </section>}
  </div>
}
