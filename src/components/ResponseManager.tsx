'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { FormField, ResponseRow, Study } from '@/lib/types'

type Assignment = { id:string; response_id:string; session_label:string; starts_at:string; ends_at:string; status:string }
type ContactThread = { id:string; response_id:string|null; channel:string; subject:string|null; status:string; last_message_at:string|null }

const dateTime=(iso?:string|null)=>iso?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso)):'—'

function answerText(field:FormField,response:ResponseRow){
  if(field.type==='availability') return (response.availability?.[field.id]||[]).join(' · ')
  const value=response.answers?.[field.id]
  if(Array.isArray(value)) return value.join(', ')
  if(value===null||value===undefined||value==='') return '—'
  return String(value)
}
function responseName(study:Study,response:ResponseRow){
  const nameField=study.form_config.fields.find(f=>f.type==='short'&&/이름|name/i.test(f.label))||study.form_config.fields.find(f=>f.type==='short')
  const value=nameField?response.answers?.[nameField.id]:null
  return String(value||response.contact_email||response.contact_phone||'참가자')
}
function download(filename:string,body:string,type:string){const blob=new Blob([body],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}
function csvCell(value:unknown){const text=value==null?'':typeof value==='string'?value:JSON.stringify(value);return `"${text.replaceAll('"','""')}"`}

export default function ResponseManager({study}:{study:Study}){
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

  function exportCsv(){
    const headers=['제출일시','이름','이메일','전화번호',...fields.map(f=>f.label),'배정 일정']
    const lines=rows.map(row=>{const schedule=assignments.filter(a=>a.response_id===row.id).map(a=>`${a.session_label} ${dateTime(a.starts_at)} (${a.status})`).join(' | ');return [dateTime(row.submitted_at),responseName(study,row),row.contact_email||'',row.contact_phone||'',...fields.map(f=>answerText(f,row)),schedule].map(csvCell).join(',')})
    download(`${study.slug}-responses.csv`,'\ufeff'+[headers.map(csvCell).join(','),...lines].join('\n'),'text/csv;charset=utf-8')
  }
  function exportJson(){download(`${study.slug}-responses.json`,JSON.stringify(rows.map(row=>({response:row,assignments:assignments.filter(a=>a.response_id===row.id),contactThreads:threads.filter(t=>t.response_id===row.id)})),null,2),'application/json;charset=utf-8')}

  return <div className="response-workspace">
    <header className="admin-page-head responses-toolbar">
      <div><span className="admin-kicker">PARTICIPANTS</span><h2>신청자</h2><p className="muted">신청 내용, 가능한 시간, 배정 일정과 연락 기록을 참가자별로 확인합니다.</p></div>
      <div className="toolbar-actions"><button className="btn secondary small" onClick={exportCsv}>CSV 내보내기</button><button className="btn ghost small" onClick={exportJson}>JSON 내보내기</button></div>
    </header>

    <div className="response-browser">
      <aside className="response-index card">
        <input className="response-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="이름 또는 연락처 검색"/>
        <div className="response-list">{filtered.map(row=><button key={row.id} className={`response-item ${selectedId===row.id?'active':''}`} onClick={()=>setSelectedId(row.id)}><span className="response-item-main"><b>{responseName(study,row)}</b><span className="muted small">{row.contact_email||row.contact_phone||'연락처 없음'}</span></span><span className="muted small">{dateTime(row.submitted_at)}</span></button>)}{!filtered.length&&<div className="empty compact">검색 결과가 없습니다.</div>}</div>
      </aside>

      <section className="response-detail card">
        {!selected?<div className="empty">확인할 신청자를 선택해주세요.</div>:<>
          <div className="response-detail-head"><div><h2>{responseName(study,selected)}</h2><div className="response-meta">{selected.contact_email&&<span>{selected.contact_email}</span>}{selected.contact_phone&&<span>{selected.contact_phone}</span>}<span>제출 {dateTime(selected.submitted_at)}</span></div></div><span className="muted small">ID {selected.id.slice(0,8)}</span></div>
          <div className="detail-section"><h3>신청 내용</h3><dl className="answer-list">{fields.filter(f=>f.type!=='availability').map(field=><div key={field.id} className="answer-row"><dt>{field.label}</dt><dd>{answerText(field,selected)}</dd></div>)}</dl></div>
          <div className="detail-section"><h3>참여 가능한 시간</h3>{fields.filter(f=>f.type==='availability').map(field=>{const slots=selected.availability?.[field.id]||[];const prefs=selected.preferences?.[field.id]||{};return <div key={field.id} className="availability-record"><div className="detail-label">{field.sessionLabel||field.label}</div><div className="record-slots">{slots.map(slot=>{const rank=Object.entries(prefs).find(([,value])=>value===slot)?.[0];return <span key={slot} className="record-slot">{slot.replace('T',' ')}{rank?` · ${rank}순위`:''}</span>})}{!slots.length&&<span className="muted small">선택한 시간이 없습니다.</span>}</div></div>})}</div>
          <div className="detail-section"><h3>일정 기록</h3><div className="record-list">{selectedAssignments.map(a=><div className="record-row" key={a.id}><div><b>{a.session_label}</b><span className="muted small">{dateTime(a.starts_at)} – {dateTime(a.ends_at)}</span></div><span className={`pill ${a.status==='confirmed'?'state-confirmed':a.status==='draft'?'state-draft':''}`}>{a.status==='confirmed'?'확정':a.status==='draft'?'미확정':a.status}</span></div>)}{!selectedAssignments.length&&<span className="muted small">아직 배정된 일정이 없습니다.</span>}</div></div>
          <div className="detail-section"><h3>연락 기록</h3><div className="record-list">{selectedThreads.map(thread=><div className="record-row" key={thread.id}><div><b>{thread.subject||'연락'}</b><span className="muted small">{thread.channel.toUpperCase()} · 최근 {dateTime(thread.last_message_at)}</span></div><span className="pill">{thread.status==='open'?'진행 중':'종료'}</span></div>)}{!selectedThreads.length&&<span className="muted small">아직 연락 기록이 없습니다.</span>}</div></div>
        </>}
      </section>
    </div>
  </div>
}
