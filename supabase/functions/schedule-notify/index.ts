import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const SECRET_KEYS=(()=>{try{return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}') as Record<string,string>}catch{return{}}})()
const ADMIN_KEY=SERVICE_ROLE_KEY||SECRET_KEYS.default||''
const CLAWMAIL_BASE='https://api.clawmail.me/v1'
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization, x-client-info, apikey, content-type','access-control-allow-methods':'POST, OPTIONS'}
const admin=createClient(SUPABASE_URL,ADMIN_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})

type Material={inbox_id:string;address:string;api_token:string;owner_email?:string|null;account_id?:string|null}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,'content-type':'application/json'}})}
async function parseResponse(response:Response){const raw=await response.text();let data:any={};try{data=raw?JSON.parse(raw):{}}catch{data={raw}};if(!response.ok)throw new Error(String(data?.error?.message||data?.error||data?.message||`HTTP ${response.status}`));return data}
async function clawFetch(path:string,token?:string,init:RequestInit={}){return parseResponse(await fetch(`${CLAWMAIL_BASE}${path}`,{...init,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{}) ,...(init.headers||{})}}))}
function addressOf(value:any){const raw=typeof value==='string'?value:value?.email??value?.address??'';const match=String(raw).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);return(match?.[0]||String(raw)).trim().toLowerCase()}
function safeMailboxName(slug:string){const stem=slug.toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,28)||'study';return`studyform-${stem}-${crypto.randomUUID().slice(0,6)}`}
function fmt(iso:string){return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))}

async function getMaterial(studyId:string):Promise<Material|null>{const{data,error}=await admin.rpc('clawmail_get_material',{p_study_id:studyId});if(error)throw error;return Array.isArray(data)&&data[0]?data[0] as Material:null}
async function putMaterial(studyId:string,material:Material){const{error}=await admin.rpc('clawmail_put_material',{p_study_id:studyId,p_inbox_id:material.inbox_id,p_address:material.address,p_api_token:material.api_token,p_owner_email:material.owner_email||'',p_account_id:material.account_id||''});if(error)throw error}
async function ensureChannel(studyId:string,material:Material){const{data:existing,error:findError}=await admin.from('study_contact_channels').select('id').eq('study_id',studyId).eq('provider','clawmail').eq('channel','email').maybeSingle();if(findError)throw findError;const payload={study_id:studyId,provider:'clawmail',channel:'email',address:material.address,provider_identity_id:material.inbox_id,status:'active',config:{polling:true,provider:'clawmail'},updated_at:new Date().toISOString()};const result=existing?.id?await admin.from('study_contact_channels').update(payload).eq('id',existing.id):await admin.from('study_contact_channels').insert(payload);if(result.error)throw result.error}
async function ensureMaterial(studyId:string,userEmail:string,slug:string){let material=await getMaterial(studyId);if(material){await ensureChannel(studyId,material);return material}const registration=await clawFetch('/register',undefined,{method:'POST',body:JSON.stringify({name:safeMailboxName(slug||studyId),owner_email:userEmail})});const token=registration.api_key??registration.token??registration.credential?.token;const inboxId=registration.inbox_id??registration.inbox?.id;const address=registration.email??registration.address??registration.inbox?.email??registration.inbox?.address;const accountId=registration.account_id??registration.account?.id??'';if(!token||!inboxId||!address)throw new Error('Research email provisioning failed');material={inbox_id:String(inboxId),address:String(address),api_token:String(token),owner_email:userEmail,account_id:String(accountId||'')};await putMaterial(studyId,material);await ensureChannel(studyId,material);return material}
function participantName(study:any,response:any){const fields=study?.form_config?.fields||[];const nameField=fields.find((f:any)=>f.type==='short'&&/이름|name/i.test(String(f.label||'')))||fields.find((f:any)=>f.type==='short');const value=nameField?response?.answers?.[nameField.id]:null;return typeof value==='string'&&value.trim()?value.trim():'참가자'}
async function ensureThread(studyId:string,responseId:string,email:string,subject:string){const{data:rows,error:findError}=await admin.from('contact_threads').select('id,subject,status,participant_address').eq('study_id',studyId).eq('response_id',responseId).eq('channel','email').neq('status','closed').order('last_message_at',{ascending:false,nullsFirst:false});if(findError)throw findError;const existing=(rows||[]).find((row:any)=>addressOf(row.participant_address)===email);if(existing)return existing;const{data,error}=await admin.from('contact_threads').insert({study_id:studyId,response_id:responseId,channel:'email',participant_address:email,subject,status:'open',source:'participant',last_message_at:new Date().toISOString()}).select('id,subject,status,participant_address').single();if(error)throw error;return data}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  let notificationId:string|null=null
  try{
    const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
    if(!jwt)return json({error:'Unauthorized'},401)
    const{data:userData,error:userError}=await admin.auth.getUser(jwt)
    if(userError||!userData.user)return json({error:'Invalid session'},401)
    const input=await req.json() as Record<string,unknown>
    const studyId=String(input.studyId||'')
    const assignmentId=String(input.assignmentId||'')
    const mode=String(input.mode||'schedule')==='cancelled'?'cancelled':'schedule'
    if(!studyId||!assignmentId)return json({error:'studyId and assignmentId are required'},400)

    const{data:study,error:studyError}=await admin.from('studies').select('id,title,slug,form_config').eq('id',studyId).eq('owner_id',userData.user.id).maybeSingle()
    if(studyError)throw studyError
    if(!study)return json({error:'Study not found'},404)
    const{data:assignment,error:assignmentError}=await admin.from('assignments').select('id,study_id,response_id,session_label,starts_at,ends_at,status').eq('id',assignmentId).eq('study_id',studyId).maybeSingle()
    if(assignmentError)throw assignmentError
    if(!assignment)return json({error:'Assignment not found'},404)
    if(mode==='schedule'&&assignment.status==='cancelled')return json({error:'Cancelled assignment cannot receive a confirmation'},400)
    if(mode==='cancelled'&&assignment.status!=='cancelled')return json({error:'Assignment is not cancelled'},400)
    const{data:response,error:responseError}=await admin.from('responses').select('id,answers,contact_email').eq('id',assignment.response_id).eq('study_id',studyId).maybeSingle()
    if(responseError)throw responseError
    if(!response)return json({error:'Participant response not found'},404)

    const kind=mode==='cancelled'?'schedule_cancellation':'schedule_confirmation'
    const snapshotStart=String(assignment.starts_at),snapshotEnd=String(assignment.ends_at)
    const{data:sentRows,error:sentLookupError}=await admin.from('notifications').select('id,metadata,created_at').eq('assignment_id',assignmentId).eq('channel','email').eq('kind',kind).eq('status','sent').order('created_at',{ascending:false})
    if(sentLookupError)throw sentLookupError
    const alreadySent=(sentRows||[]).find((row:any)=>row.metadata?.starts_at===snapshotStart&&row.metadata?.ends_at===snapshotEnd)
    if(alreadySent)return json({status:'sent',already_sent:true,event:mode==='cancelled'?'cancelled':rowEvent(sentRows||[]),notification_id:alreadySent.id})
    const event=mode==='cancelled'?'cancelled':(sentRows||[]).length?'changed':'confirmed'
    const destination=addressOf(response.contact_email||'')

    const{data:notification,error:notificationError}=await admin.from('notifications').insert({study_id:studyId,response_id:response.id,assignment_id:assignmentId,channel:'email',destination:destination||'email-unavailable',status:destination?'pending':'skipped',kind,metadata:{event,starts_at:snapshotStart,ends_at:snapshotEnd,session_label:assignment.session_label}}).select('id').single()
    if(notificationError)throw notificationError
    notificationId=notification.id
    if(!destination){await admin.from('notifications').update({error:'신청 이메일 없음'}).eq('id',notificationId);return json({status:'skipped',reason:'missing_email',event,notification_id:notificationId})}
    if(!userData.user.email)throw new Error('Researcher account has no email address')

    const material=await ensureMaterial(studyId,userData.user.email,study.slug||studyId)
    const name=participantName(study,response)
    const duration=Math.max(0,Math.round((new Date(assignment.ends_at).getTime()-new Date(assignment.starts_at).getTime())/60000))
    const subject=event==='cancelled'?`[${study.title}] 일정 취소 안내`:event==='changed'?`[${study.title}] 일정 변경 안내`:`[${study.title}] 일정 확정 안내`
    const body=event==='cancelled'
      ?`안녕하세요, ${name}님.\n\n${study.title}의 ${assignment.session_label} 일정이 취소되었습니다.\n\n기존 일시: ${fmt(assignment.starts_at)}\n\n새로운 일정이 필요한 경우 연구자가 다시 안내드리겠습니다. 문의가 있으면 이 이메일에 답장해 주세요.`
      :`안녕하세요, ${name}님.\n\n${study.title}의 ${assignment.session_label} 일정이 ${event==='changed'?'변경되었습니다':'확정되었습니다'}.\n\n일시: ${fmt(assignment.starts_at)}\n소요 시간: ${duration}분\n\n일정 변경이 필요하면 이 이메일에 답장해 주세요.`
    const thread=await ensureThread(studyId,response.id,destination,subject)
    const result=await clawFetch(`/inboxes/${encodeURIComponent(material.inbox_id)}/messages`,material.api_token,{method:'POST',body:JSON.stringify({to:destination,subject,text:body})})
    const providerId=result.message_id??result.id??null
    const sentAt=result.sent_at||new Date().toISOString()
    const baseMetadata={event,starts_at:snapshotStart,ends_at:snapshotEnd,session_label:assignment.session_label,provider_status:result.status??null,thread_id:thread.id}
    const{error:updateError}=await admin.from('notifications').update({status:'sent',provider_message_id:providerId,sent_at:sentAt,error:null,metadata:baseMetadata}).eq('id',notificationId)
    if(updateError)throw updateError

    const{error:messageError}=await admin.from('contact_messages').insert({thread_id:thread.id,direction:'outbound',body,provider_message_id:providerId,sent_at:sentAt,metadata:{provider:'clawmail',source:'schedule_notification',assignment_id:assignmentId,event,to:destination,subject,status:result.status??null}})
    if(messageError)await admin.from('notifications').update({metadata:{...baseMetadata,contact_log_error:messageError.message}}).eq('id',notificationId)
    else await admin.from('contact_threads').update({last_message_at:sentAt}).eq('id',thread.id)
    return json({status:'sent',event,notification_id:notificationId,provider_message_id:providerId,provider_status:result.status??null})
  }catch(error){
    const message=error instanceof Error?error.message:'Schedule notification failed'
    if(notificationId){const{data:existing}=await admin.from('notifications').select('status').eq('id',notificationId).maybeSingle();if(existing?.status!=='sent')await admin.from('notifications').update({status:'failed',error:message}).eq('id',notificationId)}
    return json({status:'failed',error:message,notification_id:notificationId})
  }
})

function rowEvent(rows:any[]){return rows.length?'changed':'confirmed'}
