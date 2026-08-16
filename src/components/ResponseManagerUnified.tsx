'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FormField, ResponseRow, Study } from '@/lib/types'
import { AdminListItem, AdminPageHeader, AdminPanelHeader, AdminSplitView, AdminStatus, AdminSurface, StatusBadge } from '@/components/admin/AdminUI'

type Assignment={id:string;response_id:string;session_label:string;starts_at:string;ends_at:string;status:'confirmed'|'completed'|'cancelled'|'no_show'}
type ContactThread={id:string;response_id:string|null;channel:string;subject:string|null;status:'pending'|'open'|'closed';last_message_at:string|null}

const dateTime=(iso?:string|null)=>iso?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso)):'—'
function answerText(field:FormField,response:ResponseRow){if(field.type==='availability')return(response.availability?.[field.id]||[]).join(' · ');const value=response.answers?.[field.id];if(Array.isArray(value))return value.join(', ');if(value==null||value==='')return'—';return String(value)}
function responseName(study:Study,response:ResponseRow){const nameField=study.form_config.fields.find(f=>f.type==='short'&&/이름|name/i.test(f.label))||study.form_config.fields.find(f=>f.type==='short');const value=nameField?response.answers?.[nameField.id]:null;return String(value||response.contact_email||response.contact_phone||'참가자')}
function download(filename:string,body:string,type:string){const blob=new Blob([body],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}
function csvCell(value:unknown){const text=value==null?'':typeof value==='string'?value:JSON.stringify(value);return`"${text.replaceAll('"','""')}"`}
function assignmentStatus(value:Assignment['status']):AdminStatus{return value==='confirmed'?'confirmed':value==='completed'?'completed':value==='no_show'?'danger':'neutral'}
function assignmentLabel(value:Assignment['status']){return value==='confirmed'?'확정':value==='completed'?'완료':value==='no_show'?'불참':'취소'}

export default function ResponseManagerUnified({study}:{study:Study}){
  const[rows,setRows]=useState<ResponseRow[]>([])
  const[assignments,setAssignments]=useState<Assignment[]>([])
  const[threads,setThreads]=useState<ContactThread[]>([])
  const[selectedId,setSelectedId]=useState<string|null>(null)
  const[query,setQuery]=useState('')

  useEffect(()=>{Promise.all([
    supabase.from('responses').select('*').eq('study_id',study.id).order('submitted_at',{ascending:false}),
    supabase.from('assignments').select('id,response_id,session_label,starts_at,ends_at,status').eq('study_id',study.id).order('starts_at'),
    supabase.from('contact_threads').select('id,response_id,channel,subject,status,last_message_at').eq('study_id',study.id).order('last_message_at',{ascending:false,nullsFirst:false}),
  ]).then(([r,a,t])=>{const next=(r.data||[]) as ResponseRow[];setRows(next);setAssignments((a.data||[]) as Assignment[]);setThreads((t.data||[]) as ContactThread[]);setSelectedId(current=>current&&next.some(row=>row.id===current)?current:next[0]?.id||null)})},[study.id])

  const fields=study.form_config.fields.filter(field=>field.type!=='text')
  const filtered=useMemo(()=>{const term=query.trim().toLowerCase();if(!term)return rows;return rows.filter(row=>[responseName(study,row),row.contact_email,row.contact_phone,...Object.values(row.answers||{})].flat().filter(Boolean).join(' ').toLowerCase().includes(term))},[query,rows,study])
  const selected=rows.find(row=>row.id===selectedId)||null
  const selectedAssignments=selected?assignments.filter(a=>a.response_id===selected.id):[]
  const selectedThreads=selected?threads.filter(t=>t.response_id===selected.id):[]

  function exportCsv(){const headers=['제출일시','이름','이메일','전화번호',...fields.map(f=>f.label),'일정 기록'];const lines=rows.map(row=>{const schedule=assignments.filter(a=>a.response_id===row.id).map(a=>`${a.session_label} ${dateTime(a.starts_at)} (${assignmentLabel(a.status)})`).join(' | ');return[dateTime(row.submitted_at),responseName(study,row),row.contact_email||'',row.contact_phone||'',...fields.map(f=>answerText(f,row)),schedule].map(csvCell).join(',')});download(`${study.slug}-responses.csv`,'\ufeff'+[headers.map(csvCell).join(','),...lines].join('\n'),'text/csv;charset=utf-8')}
  function exportJson(){download(`${study.slug}-responses.json`,JSON.stringify(rows.map(row=>({response:row,assignments:assignments.filter(a=>a.response_id===row.id),contactThreads:threads.filter(t=>t.response_id===row.id)})),null,2),'application/json;charset=utf-8')}

  const sidebar=<AdminSurface><AdminPanelHeader title="신청자" meta={`${rows.length}명`}/><input className="ar-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="이름 또는 연락처 검색"/><div className="aui-list">{filtered.map(row=><AdminListItem key={row.id} active={selectedId===row.id} title={responseName(study,row)} subtitle={row.contact_email||row.contact_phone||'연락처 없음'} meta={`제출 ${dateTime(row.submitted_at)}`} onClick={()=>setSelectedId(row.id)}/>)}{!filtered.length&&<div className="empty compact">검색 결과가 없습니다.</div>}</div></AdminSurface>

  return<div><AdminPageHeader kicker="PARTICIPANTS" title="신청자" description="신청 내용, 가능한 시간, 일정 상태와 연락 기록을 참가자별로 확인합니다." actions={<><button className="btn secondary small" onClick={exportCsv}>CSV 내보내기</button><button className="btn ghost small" onClick={exportJson}>JSON 내보내기</button></>}/><AdminSplitView sidebar={sidebar} sidebarWidth={310}><AdminSurface>{!selected?<div className="empty">확인할 신청자를 선택해주세요.</div>:<>
    <div className="ar-detail-head"><div><h3>{responseName(study,selected)}</h3><div className="ar-meta">{selected.contact_email&&<span>{selected.contact_email}</span>}{selected.contact_phone&&<span>{selected.contact_phone}</span>}<span>제출 {dateTime(selected.submitted_at)}</span></div></div><span className="muted small">ID {selected.id.slice(0,8)}</span></div>
    <div className="ar-section"><h4>신청 내용</h4><dl>{fields.filter(f=>f.type!=='availability').map(field=><div key={field.id} className="ar-answer"><dt>{field.label}</dt><dd>{answerText(field,selected)}</dd></div>)}</dl></div>
    <div className="ar-section"><h4>참여 가능한 시간</h4>{fields.filter(f=>f.type==='availability').map(field=>{const slots=selected.availability?.[field.id]||[];const prefs=selected.preferences?.[field.id]||{};return<div key={field.id} style={{marginBottom:14}}><div className="detail-label">{field.sessionLabel||field.label}</div><div className="ar-slots">{slots.map(slot=>{const rank=Object.entries(prefs).find(([,value])=>value===slot)?.[0];return<span key={slot} className="ar-slot">{slot.replace('T',' ')}{rank?` · ${rank}순위`:''}</span>})}{!slots.length&&<span className="muted small">선택한 시간이 없습니다.</span>}</div></div>})}</div>
    <div className="ar-section"><h4>일정 기록</h4>{selectedAssignments.map(a=><div className="ar-record" key={a.id}><div><b>{a.session_label}</b><span>{dateTime(a.starts_at)} – {dateTime(a.ends_at)}</span></div><StatusBadge status={assignmentStatus(a.status)} label={assignmentLabel(a.status)}/></div>)}{!selectedAssignments.length&&<span className="muted small">아직 일정 기록이 없습니다.</span>}</div>
    <div className="ar-section"><h4>연락 기록</h4>{selectedThreads.map(thread=><div className="ar-record" key={thread.id}><div><b>{thread.subject||'연락'}</b><span>{thread.channel.toUpperCase()} · 최근 {dateTime(thread.last_message_at)}</span></div><StatusBadge status={thread.status==='pending'?'danger':thread.status==='open'?'info':'neutral'} label={thread.status==='pending'?'답변 필요':thread.status==='open'?'진행 중':'종료'}/></div>)}{!selectedThreads.length&&<span className="muted small">아직 연락 기록이 없습니다.</span>}</div>
  </>}</AdminSurface></AdminSplitView></div>
}
