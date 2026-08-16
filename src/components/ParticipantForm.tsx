'use client'

import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FormField, Study } from '@/lib/types'

type BusyInterval = { starts_at:string; ends_at:string }

function timeText(minutes:number){return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`}
function makeSlots(f:FormField){
  const dates=f.dates?.length?f.dates:[]
  const [start,end]=(f.hours||'10:00-18:00').split('-')
  const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number)
  const step=Math.max(5,f.stepMinutes||30)
  const duration=f.duration||60
  const blocked=new Set(f.blockedSlots||[])
  const out:string[]=[]
  for(const d of dates){
    for(let m=sh*60+sm;m+duration<=eh*60+em;m+=step){
      let overlapsBlocked=false
      for(let t=m;t<m+duration;t+=step){
        if(blocked.has(`${d}T${timeText(t)}`)){overlapsBlocked=true;break}
      }
      if(!overlapsBlocked)out.push(`${d}T${timeText(m)}`)
    }
  }
  return out
}
function group(slots:string[]){const m=new Map<string,string[]>();slots.forEach(s=>{const d=s.split('T')[0];if(!m.has(d))m.set(d,[]);m.get(d)!.push(s)});return [...m.entries()]}
function overlapsBusy(field:FormField,slot:string,busy:BusyInterval[]){
  const start=new Date(`${slot}:00+09:00`).getTime()
  const end=start+(field.duration||60)*60_000
  return busy.some(item=>start<new Date(item.ends_at).getTime()&&end>new Date(item.starts_at).getTime())
}

export default function ParticipantForm({slug}:{slug:string}){
  const [study,setStudy]=useState<Study|null>(null)
  const [loading,setLoading]=useState(true)
  const [answers,setAnswers]=useState<Record<string,any>>({})
  const [availability,setAvailability]=useState<Record<string,string[]>>({})
  const [preferences,setPreferences]=useState<Record<string,Record<string,string>>>({})
  const [busyIntervals,setBusyIntervals]=useState<BusyInterval[]>([])
  const [done,setDone]=useState(false)
  const [error,setError]=useState('')

  async function fetchBusy(studyId:string){
    const {data}=await supabase.rpc('get_public_busy_intervals',{p_study_id:studyId})
    return (data||[]) as BusyInterval[]
  }

  useEffect(()=>{
    supabase.from('studies').select('*').eq('slug',slug).eq('status','published').single().then(async({data})=>{
      const next=data as Study||null
      setStudy(next)
      if(next)setBusyIntervals(await fetchBusy(next.id))
      setLoading(false)
    })
  },[slug])

  function toggle(f:FormField,slot:string){
    if(overlapsBusy(f,slot,busyIntervals))return
    setAvailability(v=>{
      const list=v[f.id]||[]
      const next=list.includes(slot)?list.filter(x=>x!==slot):[...list,slot]
      if(f.max&&next.length>f.max)return v
      setPreferences(p=>{const current={...(p[f.id]||{})};Object.keys(current).forEach(k=>{if(!next.includes(current[k]))delete current[k]});return {...p,[f.id]:current}})
      return {...v,[f.id]:next}
    })
  }

  async function submit(e:FormEvent){
    e.preventDefault();if(!study)return;setError('')
    const latestBusy=await fetchBusy(study.id)
    setBusyIntervals(latestBusy)
    for(const f of study.form_config.fields){
      const a=answers[f.id]
      if(f.type==='availability'){
        const selected=availability[f.id]||[]
        if(selected.some(slot=>overlapsBusy(f,slot,latestBusy)))return setError(`${f.label}: 방금 마감된 시간이 포함되어 있습니다. 다른 시간을 선택해주세요.`)
        const n=selected.length
        if(f.required&&n<(f.min||1))return setError(`${f.label}: 최소 ${f.min||1}개를 선택해주세요.`)
        if((f.rankTop||0)>0){const chosen=Object.values(preferences[f.id]||{}).filter(Boolean);if(new Set(chosen).size!==chosen.length)return setError(`${f.label}: 선호 순위에는 같은 시간을 중복 지정할 수 없습니다.`)}
      }else if(f.required&&f.type!=='text'&&(!a||(Array.isArray(a)&&!a.length)))return setError(`${f.label}: 필수 항목입니다.`)
    }
    const emailField=study.form_config.fields.find(f=>f.type==='email')
    const phoneField=study.form_config.fields.find(f=>f.type==='phone')
    const {error:dbError}=await supabase.from('responses').insert({study_id:study.id,participant_data:{},answers,availability,preferences,contact_email:emailField?answers[emailField.id]||null:null,contact_phone:phoneField?answers[phoneField.id]||null:null})
    if(dbError)setError(dbError.message);else setDone(true)
  }

  if(loading)return <main className="container narrow"><div className="empty">불러오는 중…</div></main>
  if(!study)return <main className="container narrow"><div className="participant-head"><h1>현재 모집 중인 실험을 찾을 수 없습니다.</h1></div></main>
  if(done)return <main className="container narrow"><div className="participant-head"><span className="pill live">제출 완료</span><h1>신청이 완료되었습니다.</h1><p className="muted">연구자가 신청 내용을 확인한 뒤 입력하신 연락처로 일정을 안내해드립니다.</p></div></main>

  return <div className="shell"><header className="topbar"><b className="brand">StudyForm</b><span className="muted small">참가 신청</span></header><main className="container narrow"><div className="participant-head"><span className="pill live">모집 중</span><h1>{study.title}</h1><p className="muted">{study.description}</p></div><form className="stack" onSubmit={submit}>{study.form_config.fields.map(f=><Question key={f.id} f={f} answers={answers} setAnswers={setAnswers} availability={availability} toggle={toggle} preferences={preferences} setPreferences={setPreferences} busyIntervals={busyIntervals}/>) }{error&&<div className="notice">{error}</div>}<div className="card stack"><div><b>입력한 내용을 확인해주세요.</b><p className="muted small">선택한 시간과 연락처를 확인한 뒤 제출해주세요. 연구자가 확인 후 일정을 안내해드립니다.</p></div><button className="btn" style={{width:'100%'}}>제출하기</button></div></form></main></div>
}

function Question({f,answers,setAnswers,availability,toggle,preferences,setPreferences,busyIntervals}:{f:FormField,answers:Record<string,any>,setAnswers:any,availability:Record<string,string[]>,toggle:(f:FormField,s:string)=>void,preferences:Record<string,Record<string,string>>,setPreferences:any,busyIntervals:BusyInterval[]}){
  if(f.type==='text')return <div className="card question"><div className="question-title">{f.label}</div>{f.description&&<div className="muted">{f.description}</div>}</div>
  if(f.type==='availability'){
    const slots=makeSlots(f),selected=availability[f.id]||[],rank=f.rankTop||0
    return <div className="card question availability"><div><div className="question-title">{f.label}{f.required&&<span className="required"> *</span>}</div><div className="muted small">{f.sessionLabel||'실험'} · {f.duration}분 · 최소 {f.min||1}개{f.max?` / 최대 ${f.max}개`:''}</div></div><div className="availability-summary"><span><b>{selected.length}</b>개 선택</span><span className="muted small">마감되지 않은 시간 중 참여 가능한 시간을 선택해주세요.</span></div><div className="day-columns">{group(slots).map(([day,list])=><div className="day" key={day}><div className="day-head">{new Date(`${day}T00:00:00`).toLocaleDateString('ko-KR',{weekday:'short',month:'short',day:'numeric'})}<span>{day}</span></div><div className="slot-list">{list.map(s=>{const closed=overlapsBusy(f,s,busyIntervals);return <button type="button" key={s} disabled={closed} className={`slot-button ${closed?'closed':''} ${!closed&&selected.includes(s)?'selected':''}`} onClick={()=>toggle(f,s)}><span>{s.split('T')[1]}</span>{closed&&<small>마감</small>}</button>})}</div></div>)}</div>{!slots.length&&<div className="empty compact">현재 선택할 수 있는 시간이 없습니다.</div>}{rank>0&&selected.length>0&&<div><b>선호 시간</b><p className="muted small">가장 선호하는 시간부터 순서대로 선택해주세요.</p><div className="ranking">{Array.from({length:Math.min(rank,selected.length)},(_,i)=><label key={i}>{i+1}순위<select value={preferences[f.id]?.[String(i+1)]||''} onChange={e=>setPreferences((p:any)=>({...p,[f.id]:{...(p[f.id]||{}),[String(i+1)]:e.target.value}}))}><option value="">선택</option>{selected.map(s=><option value={s} key={s}>{s.replace('T',' ')}</option>)}</select></label>)}</div></div>}</div>
  }
  if(f.type==='radio'||f.type==='checkbox')return <div className="card question"><div className="question-title">{f.label}{f.required&&<span className="required"> *</span>}</div>{f.description&&<div className="muted small">{f.description}</div>}<div className="choices">{(f.options||[]).map(o=><label className="choice" key={o}><input type={f.type==='radio'?'radio':'checkbox'} checked={f.type==='radio'?answers[f.id]===o:(answers[f.id]||[]).includes(o)} onChange={e=>setAnswers((a:any)=>({...a,[f.id]:f.type==='radio'?o:e.target.checked?[...(a[f.id]||[]),o]:(a[f.id]||[]).filter((x:string)=>x!==o)}))}/>{o}</label>)}</div></div>
  return <label className="card question"><span className="question-title">{f.label}{f.required&&<span className="required"> *</span>}</span>{f.description&&<span className="muted small">{f.description}</span>}{f.type==='long'?<textarea value={answers[f.id]||''} onChange={e=>setAnswers((a:any)=>({...a,[f.id]:e.target.value}))}/>:<input type={f.type==='email'?'email':f.type==='phone'?'tel':'text'} value={answers[f.id]||''} onChange={e=>setAnswers((a:any)=>({...a,[f.id]:e.target.value}))}/>}</label>
}
