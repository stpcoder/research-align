'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FormField, Study } from '@/lib/types'
import { AdminListItem, AdminPageHeader, AdminPanelHeader, AdminSplitView, AdminSurface } from '@/components/admin/AdminUI'

const newId = () => crypto.randomUUID()
const labels: Record<FormField['type'], string> = {
  short: '짧은 답변', long: '긴 답변', email: '이메일', phone: '전화번호',
  radio: '객관식', checkbox: '복수 선택', text: '안내문', availability: '시간 선택',
}
const groups = [
  { title: '기본 정보', items: [['short','짧은 답변'],['long','긴 답변'],['email','이메일'],['phone','전화번호']] as [FormField['type'],string][] },
  { title: '선택 문항', items: [['radio','객관식'],['checkbox','복수 선택'],['text','안내문']] as [FormField['type'],string][] },
  { title: '일정', items: [['availability','시간 선택']] as [FormField['type'],string][] },
]

function normalizeSlug(value:string){return value.trim().replace(/[^a-zA-Z0-9-_]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')}
function timeText(minutes:number){return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`}
function toMinutes(value:string){const [h,m]=value.split(':').map(Number);return h*60+m}
function dateLabel(date:string){return new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ko-KR',{month:'short',day:'numeric',weekday:'short'})}
function freshAvailability():FormField{return{id:newId(),type:'availability',label:'참여 가능한 시간을 선택해주세요',required:false,sessionKey:`session-${newId().slice(0,5)}`,sessionLabel:'본 실험',duration:60,stepMinutes:30,min:1,rankTop:0,dates:[],hours:'10:00-18:00',blockedSlots:[]}}

function AvailabilityEditor({field,onChange}:{field:FormField;onChange:(patch:Partial<FormField>)=>void}){
  const [newDate,setNewDate]=useState('')
  const drag=useRef<{active:boolean;block:boolean}|null>(null)
  const dates=field.dates||[]
  const blocked=useMemo(()=>new Set(field.blockedSlots||[]),[field.blockedSlots])
  const [start,end]=(field.hours||'10:00-18:00').split('-')
  const step=Math.max(5,field.stepMinutes||30)
  const rows:number[]=[]
  for(let m=toMinutes(start||'10:00');m<toMinutes(end||'18:00');m+=step) rows.push(m)

  useEffect(()=>{const stop=()=>{drag.current=null};window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);return()=>{window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop)}},[])
  function setBlocked(slot:string,value:boolean){const next=new Set(field.blockedSlots||[]);value?next.add(slot):next.delete(slot);onChange({blockedSlots:[...next].sort()})}
  function begin(slot:string){const next=!blocked.has(slot);drag.current={active:true,block:next};setBlocked(slot,next)}
  function enter(slot:string){if(drag.current?.active)setBlocked(slot,drag.current.block)}
  function addDate(){if(!newDate||dates.includes(newDate))return;onChange({dates:[...dates,newDate].sort()});setNewDate('')}
  function removeDate(date:string){onChange({dates:dates.filter(d=>d!==date),blockedSlots:(field.blockedSlots||[]).filter(slot=>!slot.startsWith(`${date}T`))})}
  function updateHours(which:'start'|'end',value:string){const ns=which==='start'?value:start;const ne=which==='end'?value:end;if(toMinutes(ne)<=toMinutes(ns))return;onChange({hours:`${ns}-${ne}`})}

  return <div className="availability-editor">
    <div className="availability-config-grid">
      <label><span>세션 이름</span><input value={field.sessionLabel||''} onChange={e=>onChange({sessionLabel:e.target.value})}/><small>관리 화면에서 사용할 이름</small></label>
      <label><span>소요 시간</span><input type="number" min={5} value={field.duration||60} onChange={e=>onChange({duration:+e.target.value})}/><small>한 번 참여하는 데 필요한 시간(분)</small></label>
      <label><span>시간 간격</span><select value={field.stepMinutes||30} onChange={e=>onChange({stepMinutes:+e.target.value})}><option value={15}>15분</option><option value={30}>30분</option><option value={60}>60분</option></select><small>참가자에게 보여줄 시작 시간 간격</small></label>
      <label><span>최소 선택</span><input type="number" min={1} value={field.min||1} onChange={e=>onChange({min:+e.target.value})}/></label>
      <label><span>최대 선택</span><input type="number" min={1} value={field.max||''} placeholder="제한 없음" onChange={e=>onChange({max:e.target.value?+e.target.value:null})}/></label>
      <label><span>선호 순위</span><input type="number" min={0} value={field.rankTop||0} onChange={e=>onChange({rankTop:+e.target.value})}/><small>0이면 선호 순위를 묻지 않습니다.</small></label>
    </div>

    <div className="availability-step">
      <div className="availability-step-head"><strong>1. 날짜</strong><span className="muted small">참가자가 선택할 날짜를 추가합니다.</span></div>
      <div className="date-add-row"><input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)}/><button type="button" className="btn secondary small" onClick={addDate}>추가</button></div>
      <div className="selected-dates">{dates.map(date=><button type="button" key={date} className="date-chip" onClick={()=>removeDate(date)}>{dateLabel(date)} <span>×</span></button>)}{!dates.length&&<span className="muted small">아직 날짜가 없습니다.</span>}</div>
    </div>

    <div className="availability-step">
      <div className="availability-step-head"><strong>2. 운영 시간</strong><span className="muted small">이 범위 안에서만 시작 시간을 제공합니다.</span></div>
      <div className="hours-row"><label>시작<input type="time" value={start} onChange={e=>updateHours('start',e.target.value)}/></label><span>–</span><label>종료<input type="time" value={end} onChange={e=>updateHours('end',e.target.value)}/></label></div>
    </div>

    <div className="availability-step">
      <div className="availability-step-head blackout-head"><div><strong>3. 제외할 시간</strong><span className="muted small">드래그한 회색 칸은 참가자에게 보이지 않습니다.</span></div>{(field.blockedSlots||[]).length>0&&<button type="button" className="btn ghost small" onClick={()=>onChange({blockedSlots:[]})}>모두 열기</button>}</div>
      {!dates.length?<div className="blackout-empty">먼저 날짜를 추가하세요.</div>:<div className="blackout-scroll"><div className="blackout-grid" style={{gridTemplateColumns:`76px repeat(${dates.length}, minmax(112px,1fr))`}} onDragStart={e=>e.preventDefault()}><div className="blackout-corner">시간</div>{dates.map(d=><div className="blackout-date" key={d}>{dateLabel(d)}</div>)}{rows.flatMap(m=>[<div className="blackout-time" key={`t-${m}`}>{timeText(m)}</div>,...dates.map(date=>{const slot=`${date}T${timeText(m)}`;const off=blocked.has(slot);return <button type="button" key={slot} className={`blackout-cell ${off?'blocked':''}`} onPointerDown={e=>{e.preventDefault();begin(slot)}} onPointerEnter={()=>enter(slot)}>{off?'사용 안 함':'사용 가능'}</button>})])}</div></div>}
      <div className="blackout-legend"><span><i className="legend-allowed"/>사용 가능</span><span><i className="legend-blocked"/>사용 안 함</span></div>
    </div>
  </div>
}

export default function FormBuilderUnified({study,refresh}:{study:Study;refresh:()=>Promise<void>}){
  const [title,setTitle]=useState(study.title)
  const [slug,setSlug]=useState(study.slug)
  const [description,setDescription]=useState(study.description)
  const [fields,setFields]=useState<FormField[]>(study.form_config?.fields||[])
  const [selectedId,setSelectedId]=useState(study.form_config?.fields?.[0]?.id||'')
  const [showAdd,setShowAdd]=useState(false)
  const [saving,setSaving]=useState(false)
  const [origin,setOrigin]=useState('')
  const [slugStatus,setSlugStatus]=useState<'idle'|'checking'|'available'|'taken'>('idle')
  const normalizedSlug=normalizeSlug(slug)
  const selectedIndex=Math.max(0,fields.findIndex(f=>f.id===selectedId))
  const selected=fields[selectedIndex]||null

  useEffect(()=>setOrigin(window.location.origin),[])
  useEffect(()=>{
    if(!normalizedSlug){setSlugStatus('idle');return}
    if(normalizedSlug===study.slug){setSlugStatus('available');return}
    setSlugStatus('checking')
    const timer=window.setTimeout(async()=>{
      const {data,error}=await supabase.from('studies').select('id').eq('slug',normalizedSlug).neq('id',study.id).maybeSingle()
      if(error){setSlugStatus('idle');return}
      setSlugStatus(data?'taken':'available')
    },350)
    return()=>window.clearTimeout(timer)
  },[normalizedSlug,study.id,study.slug])

  function patch(value:Partial<FormField>){if(!selected)return;setFields(current=>current.map(f=>f.id===selected.id?{...f,...value}:f))}
  function addField(type:FormField['type']){const field:FormField=type==='availability'?freshAvailability():{id:newId(),type,label:type==='text'?'안내 문구':'새 문항',required:false,...(['radio','checkbox'].includes(type)?{options:['선택지 1','선택지 2']}: {})};setFields(current=>[...current,field]);setSelectedId(field.id);setShowAdd(false)}
  function move(delta:number){if(!selected)return;const from=fields.findIndex(f=>f.id===selected.id);const to=from+delta;if(to<0||to>=fields.length)return;setFields(current=>{const next=[...current];[next[from],next[to]]=[next[to],next[from]];return next})}
  function remove(){if(!selected||!confirm('이 문항을 삭제할까요?'))return;const index=fields.findIndex(f=>f.id===selected.id);const next=fields.filter(f=>f.id!==selected.id);setFields(next);setSelectedId(next[Math.min(index,next.length-1)]?.id||'')}
  async function save(){
    if(!title.trim())return alert('실험 이름을 입력해주세요.')
    if(!normalizedSlug)return alert('신청 링크를 입력해주세요.')
    if(slugStatus==='taken')return alert('이미 사용 중인 신청 링크입니다.')
    setSaving(true)
    const {error}=await supabase.from('studies').update({title:title.trim(),slug:normalizedSlug,description,form_config:{fields}}).eq('id',study.id)
    setSaving(false)
    if(error){if(/duplicate|unique/i.test(error.message))setSlugStatus('taken');alert(error.message)}else{setSlug(normalizedSlug);await refresh()}
  }

  const sidebar=<AdminSurface className="af-question-index">
    <AdminPanelHeader title="문항" meta={`${fields.length}개`} actions={<button type="button" className="btn secondary small" onClick={()=>setShowAdd(v=>!v)}>+ 문항 추가</button>}/>
    {showAdd&&<div className="af-add-menu">{groups.map(group=><div className="af-add-group" key={group.title}><strong>{group.title}</strong>{group.items.map(([type,label])=><button className="af-add-option" type="button" key={type} onClick={()=>addField(type)}><span>＋</span><div><b>{label}</b><small>{type==='availability'?'날짜와 가능한 시간을 받습니다.':type==='radio'?'하나만 선택합니다.':type==='checkbox'?'여러 개를 선택합니다.':'텍스트 정보를 받습니다.'}</small></div></button>)}</div>)}</div>}
    <div className="aui-list">{fields.map((field,index)=><AdminListItem key={field.id} active={selected?.id===field.id} title={field.label||'제목 없는 문항'} subtitle={`${labels[field.type]}${field.required?' · 필수':''}`} onClick={()=>setSelectedId(field.id)} status={<span className="af-index">{index+1}</span>}/>)}</div>
  </AdminSurface>

  return <div className="af-root">
    <AdminPageHeader kicker="FORM" title="신청서 구성" description="문항을 선택해 한 개씩 편집합니다. 변경사항은 저장 후 참가자 페이지에 반영됩니다." actions={<button className="btn" onClick={save} disabled={saving||slugStatus==='taken'}>{saving?'저장 중…':'변경사항 저장'}</button>}/>

    <AdminSurface className="af-basics">
      <AdminPanelHeader title="기본 정보" description="참가자에게 보이는 신청 페이지의 이름, 링크, 소개를 설정합니다."/>
      <div className="af-basics-grid">
        <label className="aui-field major"><span>실험 이름</span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: AI 학습 실험"/></label>
        <label className="aui-field"><span>신청 링크</span><div className="af-slug"><span>/s/</span><input value={slug} onChange={e=>setSlug(e.target.value)} onBlur={()=>setSlug(normalizedSlug)} placeholder="my-study"/></div><div className="af-link-meta"><code>{origin?`${origin}/s/${normalizedSlug||'...'}`:`/s/${normalizedSlug||'...'}`}</code><span className={`af-link-state ${slugStatus}`}>{slugStatus==='checking'?'확인 중…':slugStatus==='available'?'사용 가능':slugStatus==='taken'?'이미 사용 중':'영문·숫자·-·_ 사용'}</span></div></label>
        <label className="aui-field"><span>소개</span><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="참가자에게 보여줄 간단한 실험 안내를 적어주세요."/></label>
      </div>
    </AdminSurface>

    <AdminSplitView sidebar={sidebar} sidebarWidth={300}>
      <AdminSurface className="af-editor">
        {!selected?<div className="empty">왼쪽에서 문항을 선택하세요.</div>:<>
          <div className="af-editor-head">
            <div><span>문항 {selectedIndex+1}</span><h3>{labels[selected.type]}</h3></div>
            <div className="af-editor-actions"><button type="button" className="btn ghost small" onClick={()=>move(-1)} disabled={selectedIndex===0}>↑</button><button type="button" className="btn ghost small" onClick={()=>move(1)} disabled={selectedIndex===fields.length-1}>↓</button><button type="button" className="btn danger small" onClick={remove}>삭제</button></div>
          </div>
          <div className="af-editor-body">
            <label className="aui-field major"><span>{selected.type==='text'?'안내 문구':'질문'}</span><input value={selected.label} onChange={e=>patch({label:e.target.value})} placeholder="참가자에게 보여줄 문장을 입력하세요."/></label>
            {selected.type!=='text'&&<label className="aui-field"><span>설명</span><small>선택 사항</small><input value={selected.description||''} onChange={e=>patch({description:e.target.value})} placeholder="필요한 경우 짧은 도움말을 적어주세요."/></label>}
            {selected.type!=='text'&&<label className="af-required"><input type="checkbox" checked={!!selected.required} onChange={e=>patch({required:e.target.checked})}/><div><strong>필수 응답</strong><span>참가자가 제출하기 전에 반드시 답해야 합니다.</span></div></label>}
            {['radio','checkbox'].includes(selected.type)&&<label className="aui-field"><span>선택지</span><textarea value={(selected.options||[]).join('\n')} onChange={e=>patch({options:e.target.value.split('\n').map(x=>x.trim()).filter(Boolean)})} placeholder={'선택지 1\n선택지 2'}/></label>}
            {selected.type==='availability'&&<AvailabilityEditor field={selected} onChange={patch}/>} 
          </div>
        </>}
      </AdminSurface>
    </AdminSplitView>
  </div>
}
