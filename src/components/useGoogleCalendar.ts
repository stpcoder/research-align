'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type CalendarBusy = { start:string; end:string }
type CalendarStatus = {
  configured:boolean
  connected:boolean
  scope?:string
  redirect_uri?:string
}

export function useGoogleCalendar(studyId:string){
  const [status,setStatus]=useState<CalendarStatus>({configured:false,connected:false})
  const [busy,setBusy]=useState<CalendarBusy[]>([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')

  const invoke=useCallback(async(action:string,extra:Record<string,unknown>={})=>{
    const {data:{session}}=await supabase.auth.getSession()
    if(!session?.access_token)throw new Error('로그인이 필요합니다.')
    const {data,error}=await supabase.functions.invoke('google-calendar',{
      body:{action,studyId,...extra},
      headers:{Authorization:`Bearer ${session.access_token}`},
    })
    if(error){
      let message=error.message
      try{const body=await (error as any).context?.json?.();if(body?.error)message=body.error}catch{}
      throw new Error(message)
    }
    return data
  },[studyId])

  const refreshStatus=useCallback(async()=>{
    try{
      const data=await invoke('status')
      setStatus({configured:!!data?.configured,connected:!!data?.connected,scope:data?.scope,redirect_uri:data?.redirect_uri})
      setError('')
      return data
    }catch(e){setError(e instanceof Error?e.message:'Google Calendar 상태를 확인하지 못했습니다.');return null}
  },[invoke])

  useEffect(()=>{refreshStatus()},[refreshStatus])

  const connect=useCallback(async()=>{
    setLoading(true);setError('')
    try{
      const data=await invoke('connect')
      if(data?.url)window.location.assign(data.url)
      else throw new Error(data?.error||'Google 연결 URL을 만들지 못했습니다.')
    }catch(e){setError(e instanceof Error?e.message:'Google Calendar 연결에 실패했습니다.');throw e}
    finally{setLoading(false)}
  },[invoke])

  const disconnect=useCallback(async()=>{
    setLoading(true);setError('')
    try{await invoke('disconnect');setBusy([]);await refreshStatus()}
    catch(e){setError(e instanceof Error?e.message:'Google Calendar 연결 해제에 실패했습니다.')}
    finally{setLoading(false)}
  },[invoke,refreshStatus])

  const refreshBusy=useCallback(async(timeMin:string,timeMax:string)=>{
    if(!status.connected){setBusy([]);return []}
    setLoading(true);setError('')
    try{
      const data=await invoke('busy',{timeMin,timeMax})
      const next=(data?.busy||[]) as CalendarBusy[]
      setBusy(next)
      return next
    }catch(e){setError(e instanceof Error?e.message:'Google Calendar 일정을 불러오지 못했습니다.');return []}
    finally{setLoading(false)}
  },[invoke,status.connected])

  return {status,busy,loading,error,connect,disconnect,refreshStatus,refreshBusy}
}
