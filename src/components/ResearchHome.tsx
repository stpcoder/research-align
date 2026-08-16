'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FormField, ResponseRow, Study } from '@/lib/types'

type Assignment={id:string;study_id:string;response_id:string;session_key:string;session_label:string;starts_at:string;ends_at:string;status:string}
type Thread={id:string;study_id:string;response_id:string|null;status:string;last_message_at:string|null}
type Notification={id:string;study_id:string;assignment_id:string|null;status:string;kind?:string;created_at:string}
type Metrics={responses:number;unscheduled:number;today:number;pending:number;failed:number}
type Props={user:{id:string;email?:string|null};studies:Study[];setStudy:(study:Study|null)=>void;setTab:(tab:string)=>void;loadStudies:()=>Promise<void>}

const kstDate=(iso:string|Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(typeof iso==='string'?new Date(iso):iso)
const fmt=(iso:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))
const active=(status:string)=>status!=='cancelled'
function freshFields():FormField[]{return[{id:crypto.randomUUID(),type:'short',label:'이름',required:true},{id:crypto.randomUUID(),type:'email',label:'이메일',description:'일정 확정 및 변경 안내에 사용합니다.',required:true},{id:crypto.randomUUID(),type:'phone',label:'전화번호',description:'필요 시 연구자가 직접 연락할 수 있는 번호입니다.',required:false},{id:crypto.randomUUID(),type:'availability',label:'참여 가능한 시간을 선택해주세요',sessionKey:`session-${crypto.randomUUID().slice(0,5)}`,sessionLabel:'본 실험',duration:60,stepMinutes:30,min:3,rankTop:3,dates:[],hours:'10:00-18:00',blockedSlots:[],required:true}]}

export default function ResearchHome({user,studies,setStudy,setTab,loadStudies}:Props){
  const[responses,setResponses]=useState<ResponseRow[]>([])
  const[assignments,setAssignments]=useState<Assignment[]>([])
  const[threads,setThreads]=useState<Thread[]>([])
  const[notifications,setNotifications]=useState<Notification[]>([])
  const[loading,setLoading]=useState(false)
  const studyIds=useMemo(()=>studies.map(s=>s.id),[studies])
  const studyKey=studyIds.join('|')
  const studyMap=useMemo(()=>new Map(studies.map(s=>[s.id,s])),[studies])

  useEffect(()=>{
    if(!studyIds.length){setResponses([]);setAssignments([]);setThreads([]);setNotifications([]);return}
    let cancelled=false
    Promise.all([
      supabase.from('responses').select('*').in('study_id',studyIds),
      supabase.from('assignments').select('id,study_id,response_id,session_key,session_label,starts_at,ends_at,status').in('study_id',studyIds).order('starts_at'),
      supabase.from('contact_threads').select('id,study_id,response_id,status,last_message_at').in('study_id',studyIds),
      supabase.from('notifications').select('id,study_id,assignment_id,status,kind,created_at').in('study_id',studyIds).eq('channel','email').order('created_at',{ascending:false}),
    ]).then(([r,a,t,n])=>{if(cancelled)return;setResponses((r.data||[]) as ResponseRow[]);setAssignments((a.data||[]) as Assignment[]);setThreads((t.data||[]) as Thread[]);setNotifications((n.data||[]) as Notification[])})
    return()=>{cancelled=true}
  },[studyKey])

  function sessionCount(study:Study){return study.form_config.fields.filter(f=>f.type==='availability').length}
  function participantName(row:ResponseRow){const study=studyMap.get(row.study_id);const field=study?.form_config.fields.find(f=>f.type==='short'&&/이름|name/i.test(f.label))||study?.form_config.fields.find(f=>f.type==='short');const value=field?row.answers?.[field.id]:null;return typeof value==='string'&&value.trim()?value.trim():row.contact_email||row.contact_phone||'참가자'}
  function latestNotificationFailed(studyId?:string){const latest=new Map<string,string>();for(const row of notifications){if(studyId&&row.study_id!==studyId)continue;const key=`${row.assignment_id||row.id}:${row.kind||'default'}`;if(!latest.has(key))latest.set(key,row.status)}return[...latest.values()].filter(status=>status==='failed').length}
  function metrics(study?:Study):Metrics{
    const sid=study?.id
    const rs=responses.filter(r=>!sid||r.study_id===sid)
    const as=assignments.filter(a=>(!sid||a.study_id===sid)&&active(a.status))
    const today=kstDate(new Date())
    let unscheduled=0
    for(const row of rs){const s=studyMap.get(row.study_id);const required=s?sessionCount(s):0;if(!required)continue;const scheduled=new Set(as.filter(a=>a.response_id===row.id).map(a=>a.session_key)).size;if(scheduled<required)unscheduled++}
    return{responses:rs.length,unscheduled,today:as.filter(a=>kstDate(a.starts_at)===today).length,pending:threads.filter(t=>(!sid||t.study_id===sid)&&t.status==='pending').length,failed:latestNotificationFailed(sid)}
  }

  const total=metrics()
  const perStudy=useMemo(()=>new Map(studies.map(s=>[s.id,metrics(s)])),[studies,responses,assignments,threads,notifications])
  const now=Date.now()
  const upcoming=assignments.filter(a=>a.status==='confirmed'&&new Date(a.ends_at).getTime()>=now).slice(0,10)
  function open(study:Study,tab='form'){setStudy(study);setTab(tab)}
  async function createSample(){if(loading)return;setLoading(true);const{data,error}=await supabase.rpc('create_demo_study');if(error)alert(error.message);else{await loadStudies();if(data){const{data:s}=await supabase.from('studies').select('*').eq('id',data).single();if(s)open(s as Study,'schedule')}}setLoading(false)}
  async function createStudy(){if(loading)return;setLoading(true);const slug=`study-${Math.random().toString(36).slice(2,8)}`;const{data,error}=await supabase.from('studies').insert({owner_id:user.id,title:'새 실험',slug,description:'',form_config:{fields:freshFields()},scheduling_config:{maxSessionsPerDay:1}}).select().single();setLoading(false);if(error)alert(error.message);else open(data as Study,'form')}

  return<div className="shell"><header className="topbar"><b className="brand">StudyForm</b><nav className="nav"><span className="muted small">{user.email}</span><button className="btn ghost small" onClick={()=>supabase.auth.signOut()}>로그아웃</button></nav></header><main className="container rh-root">
    <div className="rh-head"><div><h1>실험 관리</h1><p className="muted">오늘 처리할 일정과 문의를 먼저 확인하세요.</p></div><div className="row"><button className="btn secondary" disabled={loading} onClick={createSample}>샘플 실험 보기</button><button className="btn" disabled={loading} onClick={createStudy}>+ 새 실험</button></div></div>
    <section className="rh-metrics" aria-label="전체 운영 현황"><div><strong>{total.today}</strong><span>오늘 일정</span></div><div><strong>{total.unscheduled}</strong><span>일정 미정</span></div><div><strong>{total.pending}</strong><span>답변 필요</span></div><div className={total.failed?'attention':''}><strong>{total.failed}</strong><span>메일 실패</span></div></section>
    <section className="rh-grid"><div className="rh-studies"><div className="rh-section-head"><div><h2>실험</h2><span>{studies.length}개</span></div></div><div className="rh-study-list">{studies.map(study=>{const m=perStudy.get(study.id)||{responses:0,unscheduled:0,today:0,pending:0,failed:0};return<article className="card rh-study" key={study.id}><div className="rh-study-main"><div><span className={`pill ${study.status==='published'?'live':''}`}>{study.status==='published'?'모집 중':study.status==='closed'?'종료':'준비 중'}</span><h3>{study.title}</h3><span className="muted small">신청자 {m.responses}명</span></div><button className="btn secondary small" onClick={()=>open(study)}>관리</button></div><div className="rh-study-actions"><button onClick={()=>open(study,'schedule')}><strong>{m.unscheduled}</strong><span>일정 미정</span></button><button onClick={()=>open(study,'schedule')}><strong>{m.today}</strong><span>오늘 일정</span></button><button onClick={()=>open(study,'contact')} className={m.pending?'attention':''}><strong>{m.pending}</strong><span>답변 필요</span></button><button onClick={()=>open(study,'schedule')} className={m.failed?'attention':''}><strong>{m.failed}</strong><span>메일 실패</span></button></div>{study.status==='published'&&<a className="rh-public-link" href={`/s/${study.slug}`} target="_blank" rel="noreferrer">참가자 페이지 열기 ↗</a>}</article>})}{!studies.length&&<div className="empty">아직 실험이 없습니다.</div>}</div></div>
      <aside className="card rh-agenda"><div className="rh-section-head"><div><h2>전체 일정</h2><span>다가오는 일정</span></div></div><div className="rh-agenda-list">{upcoming.map(a=>{const s=studyMap.get(a.study_id);const response=responses.find(r=>r.id===a.response_id);return<button key={a.id} onClick={()=>s&&open(s,'schedule')}><time>{fmt(a.starts_at)}</time><strong>{s?.title||'실험'} · {a.session_label}</strong><span>{response?participantName(response):'참가자'}</span></button>})}{!upcoming.length&&<div className="empty compact">예정된 일정이 없습니다.</div>}</div></aside>
    </section>
  </main></div>
}
