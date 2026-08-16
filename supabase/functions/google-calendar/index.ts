import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const CALLBACK=`${SUPABASE_URL}/functions/v1/google-calendar-oauth`
const SCOPE='https://www.googleapis.com/auth/calendar.freebusy'
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization, x-client-info, apikey, content-type','access-control-allow-methods':'POST, OPTIONS'}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json'}})

async function secret(name:string){const{data,error}=await admin.rpc('deploy_control_get_secret',{p_name:name});if(error)throw error;return data as string|null}
async function googleConfig(){const[clientId,clientSecret]=await Promise.all([secret('google_calendar_client_id'),secret('google_calendar_client_secret')]);return{clientId,clientSecret,configured:!!clientId&&!!clientSecret}}
async function auth(req:Request,studyId:string){
  const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
  if(!jwt)throw new Error('Unauthorized')
  const userDb=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:`Bearer ${jwt}`}},auth:{persistSession:false,autoRefreshToken:false}})
  const{data:{user},error}=await userDb.auth.getUser(jwt);if(error||!user)throw new Error('Invalid session')
  const{data:study}=await userDb.from('studies').select('id,title').eq('id',studyId).single();if(!study)throw new Error('Study not found or not owned by this researcher')
  return{user,study}
}
async function connection(userId:string){const{data,error}=await admin.rpc('google_calendar_get_connection',{p_user_id:userId});if(error)throw error;return(data||[])[0]||null}
async function accessToken(refreshToken:string,clientId:string,clientSecret:string){
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'})
  const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body})
  const data=await res.json();if(!res.ok||!data.access_token)throw new Error(data.error_description||data.error||'Google token refresh failed');return data.access_token as string
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  try{
    const input=await req.json();const studyId=String(input.studyId||'');if(!studyId)return json({error:'studyId is required'},400)
    const{user}=await auth(req,studyId);const cfg=await googleConfig();const current=await connection(user.id)
    if(input.action==='status')return json({configured:cfg.configured,connected:!!current,scope:SCOPE,redirect_uri:CALLBACK})
    if(input.action==='connect'){
      if(!cfg.configured)return json({error:'Google Calendar OAuth client is not configured',setupRequired:true,redirect_uri:CALLBACK,scope:SCOPE},503)
      const state=crypto.randomUUID()+crypto.randomUUID().replaceAll('-','')
      const{error}=await admin.rpc('google_calendar_store_state',{p_state:state,p_user_id:user.id,p_study_id:studyId,p_expires_at:new Date(Date.now()+10*60_000).toISOString()});if(error)throw error
      const params=new URLSearchParams({client_id:cfg.clientId!,redirect_uri:CALLBACK,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent',include_granted_scopes:'true',state})
      return json({url:`https://accounts.google.com/o/oauth2/v2/auth?${params}`,redirect_uri:CALLBACK,scope:SCOPE})
    }
    if(input.action==='busy'){
      if(!cfg.configured)return json({error:'Google Calendar OAuth client is not configured',setupRequired:true,redirect_uri:CALLBACK},503)
      if(!current)return json({error:'Google Calendar is not connected'},409)
      const timeMin=String(input.timeMin||''),timeMax=String(input.timeMax||'');const min=new Date(timeMin),max=new Date(timeMax)
      if(Number.isNaN(min.getTime())||Number.isNaN(max.getTime())||max<=min||max.getTime()-min.getTime()>120*86400_000)return json({error:'Invalid calendar range'},400)
      const token=await accessToken(current.refresh_token,cfg.clientId!,cfg.clientSecret!)
      const res=await fetch('https://www.googleapis.com/calendar/v3/freeBusy',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({timeMin:min.toISOString(),timeMax:max.toISOString(),timeZone:'Asia/Seoul',items:[{id:current.calendar_id||'primary'}]})})
      const data=await res.json();if(!res.ok)throw new Error(data.error?.message||'Google Calendar free/busy failed')
      return json({busy:data.calendars?.[current.calendar_id||'primary']?.busy||[],calendar_id:current.calendar_id||'primary'})
    }
    if(input.action==='disconnect'){
      if(current&&cfg.configured){try{await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(current.refresh_token)}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'}})}catch{}}
      const{error}=await admin.rpc('google_calendar_delete_connection',{p_user_id:user.id});if(error)throw error
      return json({ok:true})
    }
    return json({error:'Unknown action'},400)
  }catch(error){return json({error:error instanceof Error?error.message:'Google Calendar request failed'},500)}
})
