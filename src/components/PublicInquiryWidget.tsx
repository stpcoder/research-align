'use client'

import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function PublicInquiryWidget({studyId,slug}:{studyId?:string;slug?:string}){
  const[resolvedStudyId,setResolvedStudyId]=useState(studyId||'')
  const[open,setOpen]=useState(false)
  const[name,setName]=useState('')
  const[email,setEmail]=useState('')
  const[message,setMessage]=useState('')
  const[busy,setBusy]=useState(false)
  const[done,setDone]=useState(false)
  const[error,setError]=useState('')

  useEffect(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem('studyform-inquiry-contact')||'{}')
      if(typeof saved.name==='string')setName(saved.name)
      if(typeof saved.email==='string')setEmail(saved.email)
    }catch{}
  },[])

  useEffect(()=>{
    if(studyId){setResolvedStudyId(studyId);return}
    if(!slug)return
    supabase.from('studies').select('id').eq('slug',slug).eq('status','published').maybeSingle().then(({data})=>setResolvedStudyId(data?.id||''))
  },[studyId,slug])

  async function submit(e:FormEvent){
    e.preventDefault()
    if(busy)return
    if(!resolvedStudyId){setError('현재 문의를 보낼 수 없습니다.');return}
    setBusy(true);setError('')
    const{error:rpcError}=await supabase.rpc('submit_public_inquiry',{
      p_study_id:resolvedStudyId,
      p_name:name.trim(),
      p_email:email.trim(),
      p_message:message.trim(),
    })
    setBusy(false)
    if(rpcError){setError(rpcError.message);return}
    try{localStorage.setItem('studyform-inquiry-contact',JSON.stringify({name:name.trim(),email:email.trim()}))}catch{}
    setMessage('')
    setDone(true)
  }

  function reopen(){setOpen(true);setDone(false);setError('')}

  return <div className="public-inquiry">
    {open&&<div className="public-inquiry-panel" role="dialog" aria-label="이메일 문의">
      <div className="public-inquiry-head">
        <div><strong>이메일 문의</strong><span>신청 전 궁금한 점을 남겨주세요.</span></div>
        <button type="button" className="public-inquiry-close" onClick={()=>setOpen(false)} aria-label="닫기">×</button>
      </div>
      {done?<div className="public-inquiry-done"><strong>문의가 접수되었습니다.</strong><span>연구자가 확인한 뒤 입력한 이메일로 답변드립니다.</span><button type="button" className="btn secondary" onClick={()=>setDone(false)}>추가 문의</button></div>:<form onSubmit={submit} className="public-inquiry-form">
        <label>이름<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} autoComplete="name" required/></label>
        <label>이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} autoComplete="email" required/></label>
        <label>문의 내용<textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={4000} placeholder="일정, 장소, 참여 조건 등 궁금한 점을 입력해주세요." required/></label>
        {error&&<div className="public-inquiry-error">{error}</div>}
        <div className="public-inquiry-foot"><span>답변은 입력한 이메일로 보내드립니다.</span><button className="btn" disabled={busy||!resolvedStudyId||!name.trim()||!email.trim()||!message.trim()}>{busy?'보내는 중…':'문의 보내기'}</button></div>
      </form>}
    </div>}
    <button type="button" className={`public-inquiry-fab ${open?'active':''}`} onClick={open?()=>setOpen(false):reopen} aria-expanded={open}>
      <span className="public-inquiry-icon">✉</span><span>이메일 문의</span>
    </button>
  </div>
}
