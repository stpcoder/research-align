import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const CALLBACK=`${SUPABASE_URL}/functions/v1/google-calendar-oauth`
const APP='https://research-align.vercel.app/'
const SCOPE='https://www.googleapis.com/auth/calendar.freebusy'

async function secret(name:string){const{data,error}=await admin.rpc('deploy_control_get_secret',{p_name:name});if(error)throw error;return data as string|null}
function redirect(params:Record<string,string>){const url=new URL(APP);for(const[k,v]of Object.entries(params))url.searchParams.set(k,v);return Response.redirect(url.toString(),302)}

Deno.serve(async(req:Request)=>{
  try{
    const url=new URL(req.url);const state=url.searchParams.get('state')||'';const code=url.searchParams.get('code')||'';const oauthError=url.searchParams.get('error')||''
    if(oauthError)return redirect({googleCalendar:'error',reason:oauthError})
    if(!state||!code)return redirect({googleCalendar:'error',reason:'missing_code_or_state'})
    const{data:stateRows,error:stateError}=await admin.rpc('google_calendar_consume_state',{p_state:state});if(stateError)throw stateError
    const row=(stateRows||[])[0];if(!row)return redirect({googleCalendar:'error',reason:'invalid_or_expired_state'})
    const[clientId,clientSecret]=await Promise.all([secret('google_calendar_client_id'),secret('google_calendar_client_secret')]);if(!clientId||!clientSecret)return redirect({googleCalendar:'error',reason:'oauth_client_not_configured'})
    const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,redirect_uri:CALLBACK,grant_type:'authorization_code'})
    const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});const tokens=await tokenRes.json();if(!tokenRes.ok)throw new Error(tokens.error_description||tokens.error||'Google token exchange failed')
    let refresh=tokens.refresh_token as string|undefined
    if(!refresh){const{data}=await admin.rpc('google_calendar_get_connection',{p_user_id:row.user_id});refresh=(data||[])[0]?.refresh_token}
    if(!refresh)throw new Error('Google did not return a refresh token. Reconnect and approve access again.')
    const{error:saveError}=await admin.rpc('google_calendar_put_connection',{p_user_id:row.user_id,p_refresh_token:refresh,p_scope:String(tokens.scope||SCOPE)});if(saveError)throw saveError
    return redirect({googleCalendar:'connected',studyId:String(row.study_id||'')})
  }catch(error){return redirect({googleCalendar:'error',reason:error instanceof Error?error.message:'oauth_failed'})}
})
