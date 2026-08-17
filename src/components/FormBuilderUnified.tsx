'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { supabase } from '@/lib/supabase'
import type { FormField, Study } from '@/lib/types'
import {
  AdminActions,
  AdminButton,
  AdminField,
  AdminIconButton,
  AdminInput,
  AdminListItem,
  AdminMenuItem,
  AdminPageHeader,
  AdminPanelHeader,
  AdminSelect,
  AdminSplitView,
  AdminSurface,
  AdminTextarea,
} from '@/components/admin/AdminUI'

const newId=()=>crypto.randomUUID()
const labels:Record<FormField['type'],string>={short:'짧은 답변',long:'긴 답변',email:'이메일',phone:'전화번호',radio:'객관식',checkbox:'복수 선택',text:'안내문',availability:'시간 선택'}
const groups=[
  {title:'기본 정보',items:[['short','짧은 답변'],['long','긴 답변'],['email','이메일'],['phone','전화번호']] as [FormField['type'],string][]},
  {title:'선택 문항',items:[['radio','객관식'],['checkbox','복수 선택'],['text','안내문']] as [FormField['type'],string][]},
  {title:'일정',items:[['availability','시간 선택']] as [FormField['type'],string][]},
]
function normalizeSlug(value:string){return value.trim().replace(/[^a-zA-Z0-9-_]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')}
function timeText(minutes:number){return`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`}
function toMinutes(value:string){const[h,m]=value.split(':').map(Number);return h*60+m}
function dateLabel(date:string){return new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ko-KR',{month:'short',day:'numeric',weekday:'short'})}
function addDays(date:string,days:number){const d=new Date(`${date}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function freshAvailability():FormField{return{id:newId(),type:'availability',label:'참여 가능한 시간을 선택해주세요',required:false,sessionKey:`session-${newId().slice(0,5)}`,sessionLabel:'본 실험',duration:60,stepMinutes:30,min:1,rankTop:0,dates:[],hours:'10:00-18:00',blockedSlots:[],location:'',instructions:'',bufferMinutes:0}}

function ChoiceEditor({options,onChange}:{options:string[];onChange:(options:string[])=>void}){
  const[dragIndex,setDragIndex]=useState<number|null>(null)
  function update(index:number,value:string){onChange(options.map((option,i)=>i===index?value:option))}
  function add(){onChange([...options,`선택지 ${options.length+1}`])}
  function remove(index:number){onChange(options.filter((_,i)=>i!==index))}
  function drop(target:number){if(dragIndex===null||dragIndex===target){setDragIndex(null);return}const next=[...options];const[moved]=next.splice(dragIndex,1);next.splice(target,0,moved);onChange(next);setDragIndex(null)}
  return <div className="af-options-editor">
    <div className="af-options-head"><strong>선택지</strong><AdminButton variant="secondary" size="sm" onClick={add}>+ 선택지</AdminButton></div>
    <div className="af-options-list">
      {options.map((option,index)=><div className={`af-option-row ${dragIndex===index?'dragging':''}`} key={index} onDragOver={e=>e.preventDefault()} onDrop={()=>drop(index)}>
        <AdminIconButton className="af-option-handle" draggable onDragStart={e=>{setDragIndex(index);e.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDragIndex(null)} aria-label={`${index+1}번 선택지 순서 변경`} title="드래그해서 순서 변경">⋮⋮</AdminIconButton>
        <span className="af-option-number">{index+1}</span>
        <AdminInput value={option} onChange={e=>update(index,e.target.value)} placeholder={`선택지 ${index+1}`}/>
        <AdminIconButton tone="danger" className="af-option-remove" onClick={()=>remove(index)} aria-label="선택지 삭제" title="선택지 삭제">×</AdminIconButton>
      </div>)}
      {!options.length&&<div className="empty compact">선택지 없음</div>}
    </div>
  </div>
}

function AvailabilityEditor({field,onChange}:{field:FormField;onChange:(patch:Partial<FormField>)=>void}){
  const[newDate,setNewDate]=useState('')
  const[rangeStart,setRangeStart]=useState('')
  const[rangeEnd,setRangeEnd]=useState('')
  const drag=useRef<{active:boolean;block:boolean}|null>(null)
  const dates=field.dates||[]
  const blocked=useMemo(()=>new Set(field.blockedSlots||[]),[field.blockedSlots])
  const[start,end]=(field.hours||'10:00-18:00').split('-')
  const step=Math.max(5,field.stepMinutes||30)
  const rows:number[]=[]
  for(let m=toMinutes(start||'10:00');m<toMinutes(end||'18:00');m+=step)rows.push(m)

  useEffect(()=>{const stop=()=>{drag.current=null};window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);return()=>{window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop)}},[])
  function setBlocked(slot:string,value:boolean){const next=new Set(field.blockedSlots||[]);value?next.add(slot):next.delete(slot);onChange({blockedSlots:[...next].sort()})}
  function begin(slot:string){const next=!blocked.has(slot);drag.current={active:true,block:next};setBlocked(slot,next)}
  function enter(slot:string){if(drag.current?.active)setBlocked(slot,drag.current.block)}
  function mergeDates(nextDates:string[]){onChange({dates:[...new Set([...dates,...nextDates])].sort()})}
  function addDate(){if(!newDate)return;mergeDates([newDate]);setNewDate('')}
  function addRange(from=rangeStart,to=rangeEnd){if(!from||!to)return alert('시작일과 종료일을 선택해주세요.');if(to<from)return alert('종료일은 시작일보다 빠를 수 없습니다.');const next:string[]=[];for(let day=from,count=0;day<=to&&count<366;day=addDays(day,1),count++)next.push(day);if(!next.length)return;mergeDates(next)}
  function addWeek(){if(!rangeStart)return alert('시작일을 먼저 선택해주세요.');const to=addDays(rangeStart,6);setRangeEnd(to);addRange(rangeStart,to)}
  function removeDate(date:string){onChange({dates:dates.filter(d=>d!==date),blockedSlots:(field.blockedSlots||[]).filter(slot=>!slot.startsWith(`${date}T`))})}
  function clearDates(){if(!dates.length)return;if(!confirm('추가한 날짜를 모두 지울까요? 제외 시간 설정도 함께 초기화됩니다.'))return;onChange({dates:[],blockedSlots:[]})}
  function updateHours(which:'start'|'end',value:string){const ns=which==='start'?value:start;const ne=which==='end'?value:end;if(toMinutes(ne)<=toMinutes(ns))return;onChange({hours:`${ns}-${ne}`})}

  return <div className="availability-editor af-availability">
    <section className="af-settings-section">
      <div className="af-settings-heading"><strong>세션 설정</strong></div>
      <div className="af-session-primary">
        <AdminField label="세션 이름" hint="예: 사전 교육, 본 실험" className="af-session-name"><AdminInput value={field.sessionLabel||''} onChange={e=>onChange({sessionLabel:e.target.value})}/></AdminField>
        <AdminField label="소요 시간" className="af-compact-field"><div className="af-input-suffix"><AdminInput type="number" min={5} value={field.duration||60} onChange={e=>onChange({duration:+e.target.value})}/><span>분</span></div></AdminField>
        <AdminField label="시작 간격" className="af-compact-field"><AdminSelect value={field.stepMinutes||30} onChange={e=>onChange({stepMinutes:+e.target.value})}><option value={15}>15분</option><option value={30}>30분</option><option value={60}>60분</option></AdminSelect></AdminField>
      </div>
      <div className="af-session-ops">
        <AdminField label="장소"><AdminInput value={field.location||''} onChange={e=>onChange({location:e.target.value})} placeholder="예: C5 123호 / Zoom"/></AdminField>
        <AdminField label="준비 시간" hint="세션 뒤 비워둘 시간" className="af-buffer"><AdminSelect value={field.bufferMinutes||0} onChange={e=>onChange({bufferMinutes:+e.target.value})}><option value={0}>없음</option><option value={5}>5분</option><option value={10}>10분</option><option value={15}>15분</option><option value={30}>30분</option><option value={60}>60분</option></AdminSelect></AdminField>
      </div>
      <AdminField label="참가자 안내"><AdminTextarea className="af-session-instructions" value={field.instructions||''} onChange={e=>onChange({instructions:e.target.value})} placeholder="예: 노트북을 지참해주세요. 건물 1층에서 연락주세요."/></AdminField>
    </section>

    <section className="af-settings-section">
      <div className="af-settings-heading"><strong>참가자 선택 규칙</strong></div>
      <div className="af-rule-row">
        <AdminField label="최소 선택"><AdminInput type="number" min={1} value={field.min||1} onChange={e=>onChange({min:+e.target.value})}/></AdminField>
        <AdminField label="최대 선택"><AdminInput type="number" min={1} value={field.max||''} placeholder="제한 없음" onChange={e=>onChange({max:e.target.value?+e.target.value:null})}/></AdminField>
        <AdminField label="선호 순위" hint="0이면 순위 없음"><AdminInput type="number" min={0} value={field.rankTop||0} onChange={e=>onChange({rankTop:+e.target.value})}/></AdminField>
      </div>
    </section>

    <section className="af-settings-section">
      <div className="af-settings-heading blackout-head"><strong>날짜</strong>{dates.length>0&&<AdminButton variant="text" size="sm" onClick={clearDates}>모두 지우기</AdminButton>}</div>
      <div className="af-date-entry"><AdminInput type="date" value={newDate} onChange={e=>setNewDate(e.target.value)}/><AdminButton variant="secondary" onClick={addDate}>날짜 추가</AdminButton></div>
      <div className="af-range-entry">
        <AdminField label="시작일"><AdminInput type="date" value={rangeStart} onChange={e=>{setRangeStart(e.target.value);if(rangeEnd&&rangeEnd<e.target.value)setRangeEnd('')}}/></AdminField>
        <AdminField label="종료일"><AdminInput type="date" min={rangeStart||undefined} value={rangeEnd} onChange={e=>setRangeEnd(e.target.value)}/></AdminField>
        <AdminActions className="af-range-actions"><AdminButton variant="secondary" onClick={addWeek} disabled={!rangeStart}>7일 추가</AdminButton><AdminButton variant="secondary" onClick={()=>addRange()} disabled={!rangeStart||!rangeEnd}>기간 추가</AdminButton></AdminActions>
      </div>
      {dates.length>0&&<div className="af-date-count">{dates.length}일 표시</div>}
      <div className="af-date-list">{dates.map(date=><AdminButton type="button" key={date} variant="text" size="sm" onClick={()=>removeDate(date)}>{dateLabel(date)} ×</AdminButton>)}</div>
    </section>

    <section className="af-settings-section">
      <div className="af-settings-heading"><strong>운영 시간</strong></div>
      <div className="af-hours-entry"><AdminField label="시작"><AdminInput type="time" value={start} onChange={e=>updateHours('start',e.target.value)}/></AdminField><span className="af-time-separator">–</span><AdminField label="종료"><AdminInput type="time" value={end} onChange={e=>updateHours('end',e.target.value)}/></AdminField></div>
    </section>

    <section className="af-settings-section af-blackout-section">
      <div className="af-settings-heading blackout-head"><strong>제외할 시간</strong>{(field.blockedSlots||[]).length>0&&<AdminButton variant="text" size="sm" onClick={()=>onChange({blockedSlots:[]})}>모두 열기</AdminButton>}</div>
      {!dates.length?<div className="empty compact">날짜를 먼저 추가하세요.</div>:<div className="blackout-scroll"><div className="blackout-grid" style={{gridTemplateColumns:`76px repeat(${dates.length}, minmax(112px,1fr))`}} onDragStart={e=>e.preventDefault()}><div className="blackout-corner">시간</div>{dates.map(d=><div className="blackout-date" key={d}>{dateLabel(d)}</div>)}{rows.flatMap(m=>[<div className="blackout-time" key={`t-${m}`}>{timeText(m)}</div>,...dates.map(date=>{const slot=`${date}T${timeText(m)}`;const off=blocked.has(slot);return<button type="button" key={slot} className={`blackout-cell ${off?'blocked':''}`} onPointerDown={e=>{e.preventDefault();begin(slot)}} onPointerEnter={()=>enter(slot)}>{off?'사용 안 함':'사용 가능'}</button>})])}</div></div>}
      <div className="blackout-legend"><span><i className="legend-allowed"/>사용 가능</span><span><i className="legend-blocked"/>사용 안 함</span></div>
    </section>
  </div>
}

export default function FormBuilderUnified({study,refresh}:{study:Study;refresh:()=>Promise<void>}){
  const[title,setTitle]=useState(study.title)
  const[slug,setSlug]=useState(study.slug)
  const[description,setDescription]=useState(study.description)
  const[fields,setFields]=useState<FormField[]>(study.form_config?.fields||[])
  const[selectedId,setSelectedId]=useState(study.form_config?.fields?.[0]?.id||'')
  const[showAdd,setShowAdd]=useState(false)
  const[saving,setSaving]=useState(false)
  const[origin,setOrigin]=useState('')
  const[slugStatus,setSlugStatus]=useState<'idle'|'checking'|'available'|'taken'>('idle')
  const[dragFieldId,setDragFieldId]=useState<string|null>(null)
  const normalizedSlug=normalizeSlug(slug)
  const selectedIndex=Math.max(0,fields.findIndex(f=>f.id===selectedId))
  const selected=fields[selectedIndex]||null
  const dirty=title!==study.title||normalizedSlug!==study.slug||description!==study.description||JSON.stringify(fields)!==JSON.stringify(study.form_config?.fields||[])

  useEffect(()=>setOrigin(window.location.origin),[])
  useEffect(()=>{(window as any).__studyFormDirty=dirty;const before=(event:BeforeUnloadEvent)=>{if(!dirty)return;event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',before);return()=>{window.removeEventListener('beforeunload',before);(window as any).__studyFormDirty=false}},[dirty])
  useEffect(()=>{if(!normalizedSlug){setSlugStatus('idle');return}if(normalizedSlug===study.slug){setSlugStatus('available');return}setSlugStatus('checking');const timer=window.setTimeout(async()=>{const{data,error}=await supabase.from('studies').select('id').eq('slug',normalizedSlug).neq('id',study.id).maybeSingle();if(error){setSlugStatus('idle');return}setSlugStatus(data?'taken':'available')},350);return()=>window.clearTimeout(timer)},[normalizedSlug,study.id,study.slug])
  useEffect(()=>{(window as any).__studyFormSave=save;return()=>{if((window as any).__studyFormSave===save)delete (window as any).__studyFormSave}})

  function patch(value:Partial<FormField>){if(!selected)return;setFields(current=>current.map(f=>f.id===selected.id?{...f,...value}:f))}
  function addField(type:FormField['type']){const field:FormField=type==='availability'?freshAvailability():{id:newId(),type,label:type==='text'?'안내 문구':'새 문항',required:false,...(['radio','checkbox'].includes(type)?{options:['선택지 1','선택지 2']}: {})};setFields(current=>[...current,field]);setSelectedId(field.id);setShowAdd(false)}
  function reorderFields(sourceId:string,targetId:string){if(sourceId===targetId)return;setFields(current=>{const from=current.findIndex(field=>field.id===sourceId),to=current.findIndex(field=>field.id===targetId);if(from<0||to<0)return current;const next=[...current];const[moved]=next.splice(from,1);next.splice(to,0,moved);return next})}
  function handleDrop(event:DragEvent<HTMLButtonElement>,targetId:string){event.preventDefault();if(dragFieldId)reorderFields(dragFieldId,targetId);setDragFieldId(null)}
  function remove(){if(!selected||!confirm('이 문항을 삭제할까요?'))return;const index=fields.findIndex(f=>f.id===selected.id);const next=fields.filter(f=>f.id!==selected.id);setFields(next);setSelectedId(next[Math.min(index,next.length-1)]?.id||'')}
  async function save(){if(!title.trim())return alert('실험 이름을 입력해주세요.');if(!normalizedSlug)return alert('신청 링크를 입력해주세요.');if(slugStatus==='taken')return alert('이미 사용 중인 신청 링크입니다.');setSaving(true);const{error}=await supabase.from('studies').update({title:title.trim(),slug:normalizedSlug,description,form_config:{fields}}).eq('id',study.id);setSaving(false);if(error){if(/duplicate|unique/i.test(error.message))setSlugStatus('taken');alert(error.message)}else{setSlug(normalizedSlug);await refresh()}}

  const sidebar=<AdminSurface className="af-question-index">
    <AdminPanelHeader title="문항" meta={`${fields.length}개`} actions={<AdminButton variant="secondary" size="sm" onClick={()=>setShowAdd(v=>!v)}>+ 문항 추가</AdminButton>}/>
    {showAdd&&<div className="af-add-menu">{groups.map(group=><div className="af-add-group" key={group.title}><strong>{group.title}</strong>{group.items.map(([type,label])=><AdminMenuItem key={type} leading="＋" title={label} onClick={()=>addField(type)}/>)}</div>)}</div>}
    <div className="aui-list">{fields.map((field,index)=><AdminListItem key={field.id} active={selected?.id===field.id} title={field.label||'제목 없는 문항'} subtitle={`${labels[field.type]}${field.required?' · 필수':''}`} onClick={()=>setSelectedId(field.id)} draggable className={dragFieldId===field.id?'af-dragging':''} leading={<span className="af-row-leading"><span className="af-drag-handle">⋮⋮</span><span className="af-index">{index+1}</span></span>} onDragStart={e=>{setDragFieldId(field.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',field.id)}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move'}} onDrop={e=>handleDrop(e,field.id)} onDragEnd={()=>setDragFieldId(null)}/>)}</div>
  </AdminSurface>

  return <div className="af-root">
    <AdminPageHeader title="신청서 구성" actions={<AdminActions>{dirty&&<span className="af-save-state dirty">저장하지 않은 변경</span>}<AdminButton onClick={save} disabled={saving||slugStatus==='taken'||!dirty}>{saving?'저장 중…':'변경사항 저장'}</AdminButton></AdminActions>}/>
    <AdminSurface className="af-basics">
      <AdminPanelHeader title="기본 정보"/>
      <div className="af-basics-grid">
        <AdminField label="실험 이름" className="major"><AdminInput value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: AI 학습 실험"/></AdminField>
        <AdminField label="신청 링크">
          <div className="af-slug"><span>/s/</span><AdminInput value={slug} onChange={e=>setSlug(e.target.value)} onBlur={()=>setSlug(normalizedSlug)} placeholder="my-study"/></div>
          <div className="af-link-meta"><code>{origin?`${origin}/s/${normalizedSlug||'...'}`:`/s/${normalizedSlug||'...'}`}</code>{slugStatus!=='idle'&&<span className={`af-link-state ${slugStatus}`}>{slugStatus==='checking'?'확인 중…':slugStatus==='available'?'사용 가능':'이미 사용 중'}</span>}</div>
        </AdminField>
        <AdminField label="소개"><AdminTextarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="참가자에게 보여줄 간단한 실험 안내를 적어주세요."/></AdminField>
      </div>
    </AdminSurface>
    <AdminSplitView sidebar={sidebar} sidebarWidth={300}>
      <AdminSurface className="af-editor">{!selected?<div className="empty">문항을 선택하세요.</div>:<>
        <div className="af-editor-head"><h3>{labels[selected.type]}</h3><AdminButton variant="danger" size="sm" onClick={remove}>문항 삭제</AdminButton></div>
        <div className="af-editor-body">
          <AdminField label={selected.type==='text'?'안내 문구':'질문'} className="major"><AdminInput value={selected.label} onChange={e=>patch({label:e.target.value})} placeholder="참가자에게 보여줄 문장을 입력하세요."/></AdminField>
          {selected.type!=='text'&&<AdminField label="설명 (선택)"><AdminInput value={selected.description||''} onChange={e=>patch({description:e.target.value})} placeholder="필요한 경우 짧은 도움말을 적어주세요."/></AdminField>}
          {selected.type!=='text'&&<label className="af-required"><input type="checkbox" checked={!!selected.required} onChange={e=>patch({required:e.target.checked})}/><span>필수 응답</span></label>}
          {['radio','checkbox'].includes(selected.type)&&<ChoiceEditor options={selected.options||[]} onChange={options=>patch({options})}/>} 
          {selected.type==='availability'&&<AvailabilityEditor field={selected} onChange={patch}/>} 
        </div>
      </>}</AdminSurface>
    </AdminSplitView>
  </div>
}
