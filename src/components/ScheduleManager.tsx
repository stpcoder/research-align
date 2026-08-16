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

const kstDate = (iso:string) => new Intl.DateTimeFormat('en-CA', {
  timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit'
}).format(new Date(iso))

const fmtDateTime = (iso:string) => new Intl.DateTimeFormat('ko-KR', {
  timeZone:'Asia/Seoul', month:'long', day:'numeric', weekday:'short', hour:'2-digit', minute:'2-digit'
}).format(new Date(iso))

const fmtDay = (day:string) => new Date(`${day}T00:00:00+09:00`).toLocaleDateString('ko-KR', {
  month:'long', day:'numeric', weekday:'short'
})

function groupSlots(slots:string[]) {
  const map = new Map<string,string[]>()
  for (const slot of slots) {
    const day = slot.split('T')[0]
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(slot)
  }
  return [...map.entries()]
}

export default function ScheduleManager({study}:{study:Study}) {
  const [responses,setResponses] = useState<ResponseRow[]>([])
  const [assignments,setAssignments] = useState<Assignment[]>([])
  const [selectedId,setSelectedId] = useState<string>('')
  const [busy,setBusy] = useState(false)

  const availabilityFields = useMemo(
    () => study.form_config.fields.filter(f=>f.type==='availability'),
    [study.form_config.fields]
  )
  const nameField = useMemo(
    () => study.form_config.fields.find(f=>f.type==='short' && /이름|name/i.test(f.label))
      || study.form_config.fields.find(f=>f.type==='short'),
    [study.form_config.fields]
  )
  const sessionOrder = (study.scheduling_config?.sessionOrder as string[]|undefined)
    || availabilityFields.map(f=>f.sessionKey||f.id)
  const maxSessionsPerDay = Number(study.scheduling_config?.maxSessionsPerDay||0)

  const selected = responses.find(r=>r.id===selectedId) || responses[0] || null

  function participantName(row:ResponseRow) {
    if (nameField) {
      const value = row.answers?.[nameField.id]
      if (typeof value === 'string' && value.trim()) return value
    }
    return row.contact_email || row.contact_phone || '참가자'
  }

  async function load() {
    const [{data:r},{data:a}] = await Promise.all([
      supabase.from('responses').select('*').eq('study_id',study.id).order('submitted_at'),
      supabase.from('assignments').select('*').eq('study_id',study.id).order('starts_at'),
    ])
    const nextResponses=(r||[]) as ResponseRow[]
    setResponses(nextResponses)
    setAssignments((a||[]) as Assignment[])
    setSelectedId(current => current || nextResponses[0]?.id || '')
  }

  useEffect(()=>{ load() },[study.id])

  function rankFor(field:FormField,slot:string) {
    if (!selected) return 0
    const pref = selected.preferences?.[field.id] || {}
    const found = Object.entries(pref).find(([,value])=>value===slot)
    return found ? Number(found[0]) : 0
  }

  function selectedAssignment(field:FormField) {
    if (!selected) return null
    const sessionKey = field.sessionKey || field.id
    return assignments.find(a=>a.response_id===selected.id && a.session_key===sessionKey && a.status!=='cancelled') || null
  }

  async function assign(field:FormField,slot:string) {
    if (!selected || busy) return
    const sessionKey = field.sessionKey || field.id
    const start = new Date(`${slot}:00+09:00`)
    const end = new Date(start.getTime() + (field.duration||60)*60_000)

    const overlapping = assignments.find(a => {
      if (a.status==='cancelled') return false
      if (a.response_id===selected.id && a.session_key===sessionKey) return false
      const aStart = new Date(a.starts_at).getTime()
      const aEnd = new Date(a.ends_at).getTime()
      return start.getTime() < aEnd && end.getTime() > aStart
    })
    if (overlapping) {
      alert(`이미 ${participantName(responses.find(r=>r.id===overlapping.response_id) || selected)} 참가자의 일정과 겹칩니다.`)
      return
    }

    if (maxSessionsPerDay>0) {
      const sameDay = assignments.filter(a =>
        a.response_id===selected.id && a.status!=='cancelled' && a.session_key!==sessionKey && kstDate(a.starts_at)===slot.split('T')[0]
      ).length
      if (sameDay >= maxSessionsPerDay) {
        alert(`이 참가자는 하루에 최대 ${maxSessionsPerDay}개 세션만 배정할 수 있습니다.`)
        return
      }
    }

    const orderIndex = sessionOrder.indexOf(sessionKey)
    if (orderIndex>0) {
      const missing = sessionOrder.slice(0,orderIndex).find(key =>
        !assignments.some(a=>a.response_id===selected.id && a.session_key===key && a.status!=='cancelled')
      )
      if (missing) {
        const prior = availabilityFields.find(f=>(f.sessionKey||f.id)===missing)
        alert(`${prior?.sessionLabel||'이전 세션'} 일정을 먼저 배정해주세요.`)
        return
      }
    }

    setBusy(true)
    const {error}=await supabase.from('assignments').upsert({
      study_id:study.id,
      response_id:selected.id,
      session_key:sessionKey,
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
    if (!confirm(`${participantName(responses.find(r=>r.id===a.response_id) || selected!)} 참가자의 ${a.session_label} 일정을 삭제할까요?`)) return
    await supabase.from('assignments').delete().eq('id',a.id)
    await load()
  }

  const confirmedCount = assignments.filter(a=>a.status==='confirmed').length

  return <div className="schedule-workspace">
    <div className="schedule-overview">
      <div>
        <h2>일정 배정</h2>
        <p className="muted">참가자를 선택한 뒤, 신청할 때 선택한 시간 중 하나를 눌러 일정을 배정하세요.</p>
      </div>
      <div className="schedule-summary muted small">신청자 {responses.length}명 · 배정 {assignments.length}건 · 확정 {confirmedCount}건</div>
    </div>

    <div className="schedule-browser">
      <aside className="card schedule-participants">
        <div className="section-head">
          <h3>참가자</h3>
          <span className="muted small">{responses.length}명</span>
        </div>
        <div className="people">
          {responses.map(r=><button
            type="button"
            key={r.id}
            className={`person ${selected?.id===r.id?'active':''}`}
            onClick={()=>setSelectedId(r.id)}
          >
            <strong>{participantName(r)}</strong>
            <span className="muted small">{r.contact_email || r.contact_phone || '연락처 없음'}</span>
          </button>)}
          {!responses.length&&<div className="empty compact">아직 신청자가 없습니다.</div>}
        </div>
      </aside>

      <section className="card schedule-detail">
        {!selected ? <div className="empty">왼쪽에서 참가자를 선택하세요.</div> : <>
          <div className="schedule-detail-head">
            <div>
              <h2>{participantName(selected)}</h2>
              <div className="response-meta">
                {selected.contact_email&&<span>{selected.contact_email}</span>}
                {selected.contact_phone&&<span>{selected.contact_phone}</span>}
              </div>
            </div>
            <span className="muted small">시간 버튼을 누르면 우선 ‘미확정’ 일정으로 저장됩니다.</span>
          </div>

          <div className="session-list">
            {availabilityFields.map(field=>{
              const current = selectedAssignment(field)
              const slots = selected.availability?.[field.id] || []
              return <section className="session-block" key={field.id}>
                <div className="session-head">
                  <div>
                    <h3>{field.sessionLabel||field.label}</h3>
                    <span className="muted small">소요 시간 {field.duration||60}분</span>
                  </div>
                  {current&&<span className={`pill ${current.status==='confirmed'?'live':''}`}>
                    {current.status==='confirmed'?'일정 확정':'미확정'} · {fmtDateTime(current.starts_at)}
                  </span>}
                </div>
                <p className="muted small session-help">참가자가 신청할 때 선택한 시간입니다. 선호 순위가 있으면 함께 표시됩니다.</p>
                <div className="session-days">
                  {groupSlots(slots).map(([day,daySlots])=><div className="session-day" key={day}>
                    <div className="session-date">{fmtDay(day)}</div>
                    <div className="session-times">
                      {daySlots.map(slot=>{
                        const rank=rankFor(field,slot)
                        return <button
                          type="button"
                          className="slot-button schedule-slot"
                          key={slot}
                          disabled={busy}
                          onClick={()=>assign(field,slot)}
                        >
                          <span>{slot.split('T')[1]}</span>
                          {rank>0&&<small>{rank}순위</small>}
                        </button>
                      })}
                    </div>
                  </div>)}
                  {!slots.length&&<div className="empty compact">선택한 시간이 없습니다.</div>}
                </div>
              </section>
            })}
          </div>
        </>}
      </section>
    </div>

    <section className="card schedule-current">
      <div className="section-head">
        <div>
          <h3>현재 일정</h3>
          <p className="muted small">미확정 일정을 검토한 뒤 ‘일정 확정’을 누르면 확정 상태로 바뀝니다.</p>
        </div>
      </div>
      <div className="schedule-table">
        <div className="schedule-table-head">
          <span>참가자</span><span>세션</span><span>일시</span><span>상태</span><span>관리</span>
        </div>
        {assignments.map(a=><div className="schedule-table-row" key={a.id}>
          <strong>{participantName(responses.find(r=>r.id===a.response_id) || ({answers:{},availability:{},preferences:{}} as ResponseRow))}</strong>
          <span>{a.session_label}</span>
          <span>{fmtDateTime(a.starts_at)}</span>
          <span><span className={`pill ${a.status==='confirmed'?'live':''}`}>{a.status==='confirmed'?'확정':a.status==='completed'?'완료':'미확정'}</span></span>
          <div className="row schedule-actions">
            <button className="btn secondary small" onClick={()=>toggleConfirm(a)}>{a.status==='confirmed'?'확정 취소':'일정 확정'}</button>
            <button className="btn danger small" onClick={()=>removeAssignment(a)}>삭제</button>
          </div>
        </div>)}
        {!assignments.length&&<div className="empty compact">아직 배정된 일정이 없습니다.</div>}
      </div>
    </section>
  </div>
}
