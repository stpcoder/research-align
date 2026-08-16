'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FormField, Study } from '@/lib/types'

const newId = () => crypto.randomUUID()
const fieldTypes:[FormField['type'],string][] = [
  ['short','짧은 답변'],['long','긴 답변'],['email','이메일'],['phone','전화번호'],
  ['radio','객관식'],['checkbox','복수 선택'],['text','안내문'],['availability','시간 선택'],
]

function freshAvailability():FormField {
  return {
    id:newId(), type:'availability', label:'참여 가능한 시간을 선택해주세요', required:false,
    sessionKey:`session-${newId().slice(0,5)}`, sessionLabel:'본 실험', duration:60,
    stepMinutes:30, min:1, rankTop:0, dates:[], hours:'10:00-18:00', blockedSlots:[],
  }
}

function timeText(minutes:number) {
  return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`
}
function toMinutes(value:string) {
  const [h,m]=value.split(':').map(Number)
  return h*60+m
}
function dateLabel(date:string) {
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ko-KR',{month:'short',day:'numeric',weekday:'short'})
}

function AvailabilityEditor({field,onChange}:{field:FormField,onChange:(patch:Partial<FormField>)=>void}) {
  const [newDate,setNewDate]=useState('')
  const drag=useRef<{active:boolean;block:boolean}|null>(null)
  const dates=field.dates||[]
  const blocked=useMemo(()=>new Set(field.blockedSlots||[]),[field.blockedSlots])
  const [start,end]=(field.hours||'10:00-18:00').split('-')
  const step=Math.max(5,field.stepMinutes||30)
  const startMin=toMinutes(start||'10:00')
  const endMin=toMinutes(end||'18:00')
  const rows:number[]=[]
  for(let m=startMin;m<endMin;m+=step) rows.push(m)

  useEffect(()=>{
    const stop=()=>{drag.current=null}
    window.addEventListener('pointerup',stop)
    window.addEventListener('pointercancel',stop)
    return()=>{window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop)}
  },[])

  function setBlocked(slot:string,shouldBlock:boolean) {
    const next=new Set(field.blockedSlots||[])
    if(shouldBlock) next.add(slot); else next.delete(slot)
    onChange({blockedSlots:[...next].sort()})
  }
  function begin(slot:string) {
    const shouldBlock=!blocked.has(slot)
    drag.current={active:true,block:shouldBlock}
    setBlocked(slot,shouldBlock)
  }
  function enter(slot:string) {
    if(drag.current?.active) setBlocked(slot,drag.current.block)
  }
  function addDate() {
    if(!newDate||dates.includes(newDate)) return
    onChange({dates:[...dates,newDate].sort()})
    setNewDate('')
  }
  function removeDate(date:string) {
    onChange({
      dates:dates.filter(d=>d!==date),
      blockedSlots:(field.blockedSlots||[]).filter(slot=>!slot.startsWith(`${date}T`)),
    })
  }
  function updateHour(which:'start'|'end',value:string) {
    const nextStart=which==='start'?value:start
    const nextEnd=which==='end'?value:end
    if(toMinutes(nextEnd)<=toMinutes(nextStart)) return
    onChange({hours:`${nextStart}-${nextEnd}`})
  }

  return <div className="availability-editor">
    <div className="availability-config-grid">
      <label>세션 이름<input value={field.sessionLabel||''} onChange={e=>onChange({sessionLabel:e.target.value})}/></label>
      <label>소요 시간<input type="number" min={5} value={field.duration||60} onChange={e=>onChange({duration:+e.target.value})}/><span className="field-hint">분</span></label>
      <label>시간 간격<select value={field.stepMinutes||30} onChange={e=>onChange({stepMinutes:+e.target.value})}><option value={15}>15분</option><option value={30}>30분</option><option value={60}>60분</option></select></label>
      <label>최소 선택<input type="number" min={1} value={field.min||1} onChange={e=>onChange({min:+e.target.value})}/></label>
      <label>최대 선택<input type="number" min={1} value={field.max||''} placeholder="제한 없음" onChange={e=>onChange({max:e.target.value?+e.target.value:null})}/></label>
      <label>선호 순위<input type="number" min={0} value={field.rankTop||0} onChange={e=>onChange({rankTop:+e.target.value})}/><span className="field-hint">0이면 사용 안 함</span></label>
    </div>

    <div className="availability-step">
      <div className="availability-step-head"><strong>1. 모집 날짜</strong><span className="muted small">참가자가 선택할 수 있는 날짜를 추가하세요.</span></div>
      <div className="date-add-row"><input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)}/><button type="button" className="btn secondary small" onClick={addDate}>날짜 추가</button></div>
      <div className="selected-dates">{dates.map(date=><button type="button" key={date} className="date-chip" onClick={()=>removeDate(date)}>{dateLabel(date)} <span>×</span></button>)}{!dates.length&&<span className="muted small">아직 날짜가 없습니다.</span>}</div>
    </div>

    <div className="availability-step">
      <div className="availability-step-head"><strong>2. 운영 시간</strong><span className="muted small">이 범위 안에서 참가자에게 시간을 보여줍니다.</span></div>
      <div className="hours-row"><label>시작<input type="time" value={start} onChange={e=>updateHour('start',e.target.value)}/></label><span>–</span><label>종료<input type="time" value={end} onChange={e=>updateHour('end',e.target.value)}/></label></div>
    </div>

    <div className="availability-step">
      <div className="availability-step-head blackout-head"><div><strong>3. 사용하지 않을 시간 표시</strong><span className="muted small">마우스로 누른 채 드래그하면 회색으로 칠해집니다. 회색 칸은 참가자에게 표시되지 않습니다.</span></div>{(field.blockedSlots||[]).length>0&&<button type="button" className="btn ghost small" onClick={()=>onChange({blockedSlots:[]})}>모두 사용 가능으로</button>}</div>
      {!dates.length?<div className="blackout-empty">먼저 날짜를 추가하면 타임테이블이 나타납니다.</div>:<div className="blackout-scroll">
        <div className="blackout-grid" style={{gridTemplateColumns:`76px repeat(${dates.length}, minmax(112px,1fr))`}} onDragStart={e=>e.preventDefault()}>
          <div className="blackout-corner">시간</div>
          {dates.map(d=><div className="blackout-date" key={d}>{dateLabel(d)}</div>)}
          {rows.flatMap(m=>[
            <div className="blackout-time" key={`t-${m}`}>{timeText(m)}</div>,
            ...dates.map(date=>{const slot=`${date}T${timeText(m)}`;const isBlocked=blocked.has(slot);return <button
              type="button"
              key={slot}
              className={`blackout-cell ${isBlocked?'blocked':''}`}
              onPointerDown={e=>{e.preventDefault();begin(slot)}}
              onPointerEnter={()=>enter(slot)}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setBlocked(slot,!isBlocked)}}}
              title={isBlocked?'사용 안 함 — 드래그해서 다시 열 수 있습니다.':'사용 가능 — 드래그해서 막을 수 있습니다.'}
            >{isBlocked?'사용 안 함':'사용 가능'}</button>}),
          ])}
        </div>
      </div>}
      <div className="blackout-legend"><span><i className="legend-allowed"/>사용 가능</span><span><i className="legend-blocked"/>사용 안 함</span><span className="muted">소요 시간이 여러 칸에 걸치면, 회색 칸과 겹치는 시작 시간도 자동 제외됩니다.</span></div>
    </div>
  </div>
}

export default function FormBuilderManager({study,refresh}:{study:Study,refresh:()=>Promise<void>}) {
  const [title,setTitle]=useState(study.title)
  const [slug,setSlug]=useState(study.slug)
  const [description,setDescription]=useState(study.description)
  const [fields,setFields]=useState<FormField[]>(study.form_config?.fields||[])
  const [saving,setSaving]=useState(false)

  function patch(index:number,patchValue:Partial<FormField>) { setFields(v=>v.map((f,i)=>i===index?{...f,...patchValue}:f)) }
  async function save() {
    setSaving(true)
    const {error}=await supabase.from('studies').update({
      title,
      slug:slug.replace(/[^a-zA-Z0-9-_]/g,'-'),
      description,
      form_config:{fields},
    }).eq('id',study.id)
    setSaving(false)
    if(error) alert(error.message); else await refresh()
  }
  function addField(type:FormField['type']) {
    const base:FormField = type==='availability' ? freshAvailability() : {
      id:newId(), type, label:type==='text'?'안내 문구':'새 문항', required:false,
      ...(['radio','checkbox'].includes(type)?{options:['선택지 1','선택지 2']}:{}),
    }
    setFields(v=>[...v,base])
  }

  return <div className="form-builder">
    <div className="stack">
      <div className="card stack">
        <label>실험 제목<input value={title} onChange={e=>setTitle(e.target.value)}/></label>
        <label>공개 URL<input value={slug} onChange={e=>setSlug(e.target.value)}/></label>
        <label>실험 안내<textarea value={description} onChange={e=>setDescription(e.target.value)}/></label>
      </div>

      {fields.map((field,index)=><div className="card field-card" key={field.id}>
        <div className="field-head"><span className="field-type">{fieldTypes.find(x=>x[0]===field.type)?.[1]}</span><div className="row"><button type="button" className="btn ghost small" disabled={index===0} onClick={()=>setFields(v=>{const next=[...v];if(index>0)[next[index-1],next[index]]=[next[index],next[index-1]];return next})}>↑</button><button type="button" className="btn danger small" onClick={()=>setFields(v=>v.filter(x=>x.id!==field.id))}>삭제</button></div></div>
        <div className="stack">
          <label>문항 제목<input value={field.label} onChange={e=>patch(index,{label:e.target.value})}/></label>
          {field.type!=='text'&&<label>설명<input value={field.description||''} onChange={e=>patch(index,{description:e.target.value})}/></label>}
          {field.type!=='text'&&<label className="checkline"><input type="checkbox" checked={!!field.required} onChange={e=>patch(index,{required:e.target.checked})}/> 필수 항목</label>}
          {['radio','checkbox'].includes(field.type)&&<label>선택지 (한 줄에 하나씩)<textarea value={(field.options||[]).join('\n')} onChange={e=>patch(index,{options:e.target.value.split('\n').map(x=>x.trim()).filter(Boolean)})}/></label>}
          {field.type==='availability'&&<AvailabilityEditor field={field} onChange={value=>patch(index,value)}/>} 
        </div>
      </div>)}
    </div>

    <aside className="card side-panel">
      <h3>문항 추가</h3><p className="muted small">필요한 항목을 선택하면 신청서 맨 아래에 추가됩니다.</p>
      <div className="type-list">{fieldTypes.map(([type,label])=><button type="button" key={type} className="type-button" onClick={()=>addField(type)}>{label}</button>)}</div>
      <button type="button" className="btn" style={{width:'100%',marginTop:14}} onClick={save}>{saving?'저장 중…':'변경사항 저장'}</button>
    </aside>
  </div>
}
