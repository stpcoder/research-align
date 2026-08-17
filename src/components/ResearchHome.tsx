'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FormField, ResponseRow, Study } from '@/lib/types'
import {
  AdminActionRow,
  AdminActions,
  AdminButton,
  AdminLinkButton,
  AdminMetric,
  AdminMetricStrip,
  AdminPageHeader,
  AdminSectionHeader,
  AdminSurface,
  StatusBadge,
} from '@/components/admin/AdminUI'

type Assignment={id:string;study_id:string;response_id:string;session_key:string;session_label:string;starts_at:string;ends_at:string;status:string}
type Thread={id:string;study_id:string;response_id:string|null;status:string;last_message_at:string|null}
type Notification={id:string;study_id:string;assignment_id:string|null;status:string;kind?:string;created_at:string}
type Metrics={responses:number;unscheduled:number;today:number;pending:number;failed:number}
type Props={user:{id:string;email?:string|null};studies:Study[];setStudy:(study:Study|null)=>void;setTab:(tab:string)=>void;loadStudies:()=>Promise<void>}

const kstDate=(iso:string|Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(typeof iso==='string'?new Date(iso):iso)
const fmt=(iso:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))
const active=(status:string)=>status!=='cancelled'
function freshFields():FormField[]{return[{id:crypto.randomUUID(),type:'short',label:'이름',required:true},{id:crypto.randomUUID(),type:'email',label:'이메일',description:'일정 확정 및 변경 안내에 사용합니다.',required:true},{id:crypto.randomUUID(),type:'phone',label:'전화번호',description:'필요 시 연구자가 직접 연락할 수 있는 번호입니다.',required:false},{id:crypto.randomUUID(),type:'availability',label:'참여 가능한 시간을 선택해주세요',sessionKey:`session-${crypto.randomUUID().slice(0,5)}`,sessionLabel:'본 실험',duration:60,stepMinutes:30,min:3,rankTop:3,dates:[],hours:'10:00-18:00',blockedSlots:[],location:'',instructions:'',bufferMinutes:0,required:true}]}

export default function ResearchHome({user,studies,setStudy,setTab,loadStudies}:Props){
  const[responses,setResponses]=useState<ResponseRow[]>([])
  const[assignments,setAssignments]=useState<Assignment[]>([])
  const[threads,setThreads]=useState<Thread[]>([])
  const[notifications,setNotifications]=useState<Notification[]>([])
  const[loading,setLoading]=useState(false)
  const[deletingId,setDeletingId]=useState<string|null>(null)
  const[stoppingId,setStoppingId]=useState<string|null>(null)
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
  async function stopStudy(study:Study){
    if(stoppingId)return
    if(!window.confirm(`“${study.title}” 참가자 모집을 중지할까요?\n\n중지하면 참가자 페이지에서 더 이상 신청할 수 없고, 이후 실험을 삭제할 수 있습니다.`))return
    setStoppingId(study.id)
    const{error}=await supabase.from('studies').update({status:'closed'}).eq('id',study.id)
    if(error)alert(error.message)
    else await loadStudies()
    setStoppingId(null)
  }
  async function deleteStudy(study:Study){
    if(study.status==='published'){alert('모집 중인 실험은 먼저 모집을 중지한 뒤 삭제해주세요.');return}
    if(deletingId)return
    const typed=window.prompt(`“${study.title}” 실험을 영구 삭제합니다.\n\n신청자, 일정, 문의와 메일 기록도 함께 삭제되며 되돌릴 수 없습니다.\n삭제하려면 실험 이름을 그대로 입력해주세요.`)
    if(typed===null)return
    if(typed!==study.title){alert('실험 이름이 일치하지 않아 삭제하지 않았습니다.');return}
    setDeletingId(study.id)
    const{error}=await supabase.from('studies').delete().eq('id',study.id)
    if(error)alert(error.message)
    else await loadStudies()
    setDeletingId(null)
  }

  return <div className="shell">
    <header className="topbar"><b className="brand">StudyForm</b><nav className="nav"><span className="muted small">{user.email}</span><AdminButton variant="ghost" size="sm" onClick={()=>supabase.auth.signOut()}>로그아웃</AdminButton></nav></header>
    <main className="container rh-root">
      <AdminPageHeader title="실험 관리" description="오늘 처리할 일정과 문의를 먼저 확인하세요." actions={<AdminActions><AdminButton variant="secondary" disabled={loading} onClick={createSample}>샘플 실험 보기</AdminButton><AdminButton disabled={loading} onClick={createStudy}>+ 새 실험</AdminButton></AdminActions>}/>

      <AdminMetricStrip label="전체 운영 현황">
        <AdminMetric value={total.today} label="오늘 일정"/>
        <AdminMetric value={total.unscheduled} label="일정 미정"/>
        <AdminMetric value={total.pending} label="답변 필요"/>
        <AdminMetric value={total.failed} label="메일 실패" tone={total.failed?'danger':'default'}/>
      </AdminMetricStrip>

      <section className="rh-grid">
        <div className="rh-studies">
          <AdminSectionHeader title="실험" meta={`${studies.length}개`}/>
          <div className="rh-study-list">{studies.map(study=>{
            const m=perStudy.get(study.id)||{responses:0,unscheduled:0,today:0,pending:0,failed:0}
            const status=study.status==='published'?'confirmed':study.status==='closed'?'neutral':'draft'
            const statusLabel=study.status==='published'?'모집 중':study.status==='closed'?'종료':'준비 중'
            return <AdminSurface className="rh-study" key={study.id}>
              <div className="rh-study-main">
                <div><StatusBadge status={status} label={statusLabel}/><h3>{study.title}</h3><span className="muted small">신청자 {m.responses}명</span></div>
                <AdminActions className="rh-study-buttons">
                  <AdminButton variant="secondary" size="sm" onClick={()=>open(study)}>관리</AdminButton>
                  {study.status==='published'?<AdminButton variant="danger" size="sm" disabled={stoppingId===study.id} onClick={()=>stopStudy(study)}>{stoppingId===study.id?'중지 중…':'모집 중지'}</AdminButton>:<AdminButton variant="danger" size="sm" disabled={deletingId===study.id} onClick={()=>deleteStudy(study)}>{deletingId===study.id?'삭제 중…':'삭제'}</AdminButton>}
                </AdminActions>
              </div>
              <div className="rh-study-actions">
                <AdminButton variant="text" size="sm" onClick={()=>open(study,'schedule')}><strong>{m.unscheduled}</strong><span>일정 미정</span></AdminButton>
                <AdminButton variant="text" size="sm" onClick={()=>open(study,'schedule')}><strong>{m.today}</strong><span>오늘 일정</span></AdminButton>
                <AdminButton variant="text" size="sm" className={m.pending?'attention':''} onClick={()=>open(study,'contact')}><strong>{m.pending}</strong><span>답변 필요</span></AdminButton>
                <AdminButton variant="text" size="sm" className={m.failed?'attention':''} onClick={()=>open(study,'schedule')}><strong>{m.failed}</strong><span>메일 실패</span></AdminButton>
              </div>
              {study.status==='published'&&<AdminLinkButton className="rh-public-action" variant="text" size="sm" href={`/s/${study.slug}`} target="_blank" rel="noreferrer">참가자 페이지 열기 ↗</AdminLinkButton>}
            </AdminSurface>
          })}{!studies.length&&<div className="empty">아직 실험이 없습니다.</div>}</div>
        </div>

        <AdminSurface className="rh-agenda">
          <AdminSectionHeader title="전체 일정"/>
          <div>{upcoming.map(a=>{const s=studyMap.get(a.study_id);const response=responses.find(r=>r.id===a.response_id);return <AdminActionRow key={a.id} meta={fmt(a.starts_at)} title={`${s?.title||'실험'} · ${a.session_label}`} detail={response?participantName(response):'참가자'} onClick={()=>{if(s)open(s,'schedule')}}/>})}{!upcoming.length&&<div className="empty compact">예정된 일정이 없습니다.</div>}</div>
        </AdminSurface>
      </section>
    </main>
  </div>
}
