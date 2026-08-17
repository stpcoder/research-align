import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS')
const secretKeys = secretKeysRaw ? JSON.parse(secretKeysRaw) : {}
const ADMIN_KEY = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const sb = createClient(SUPABASE_URL, ADMIN_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const TEAM_ID = 'team_muySkNMTu5rLXyDOd5pTz1tw'
const TEAM_SLUG = 'suwonhci-3073s-projects'
const VERCEL_API = 'https://api.vercel.com'
const GITHUB_API = 'https://api.github.com'
const GITHUB_CODELOAD = 'https://codeload.github.com'

async function getSecret(name: string) {
  const { data, error } = await sb.rpc('deploy_control_get_secret', { p_name: name })
  if (error) throw error
  return data as string | null
}
async function setSecret(name: string, value: string) {
  const { error } = await sb.rpc('deploy_control_set_secret', { p_name: name, p_value: value })
  if (error) throw error
}
async function vrequest(token: string, path: string, init: RequestInit = {}, withTeam = true) {
  const url = new URL(VERCEL_API + path)
  if (withTeam && !url.searchParams.has('teamId')) url.searchParams.set('teamId', TEAM_ID)
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  const text = await res.text(); let data: any = null
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  if (!res.ok) { const err: any = new Error(data?.error?.message || data?.message || data?.error || `Vercel HTTP ${res.status}`); err.status = res.status; err.data = data; throw err }
  return data
}
async function ghRequest(path: string) {
  const token = await getSecret('github_token')
  const headers: Record<string,string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'research-align-deploy-control', 'X-GitHub-Api-Version': '2022-11-28' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(GITHUB_API + path, { headers })
  const text = await res.text(); let data: any = null
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  if (!res.ok) { const err:any = new Error(data?.message || `GitHub HTTP ${res.status}`); err.status=res.status; err.data=data; throw err }
  return data
}
async function getProject(token: string, name: string) { try { return await vrequest(token, `/v9/projects/${encodeURIComponent(name)}`) } catch (e:any) { if (e.status === 404) return null; throw e } }
async function resolveEnv(env: any[] = []) { const out=[]; for (const item of env) { let value=item.value; if(item.secretRef){ value=await getSecret(item.secretRef); if(!value) throw new Error(`Missing deploy secret: ${item.secretRef}`) } out.push({key:item.key,value,type:item.type||(item.secretRef?'encrypted':'plain'),target:item.target||['production','preview'],...(item.gitBranch?{gitBranch:item.gitBranch}:{})}) } return out }
async function waitDeployment(token: string, id: string) { let latest:any=null; for(let i=0;i<24;i++){ latest=await vrequest(token,`/v13/deployments/${encodeURIComponent(id)}`); const state=latest.readyState||latest.status||latest.state; if(['READY','ERROR','CANCELED','CANCELLED'].includes(state)) return latest; await new Promise(r=>setTimeout(r,2000)) } return latest }
async function recordState(state:any){ const {error}=await sb.from('deploy_control_state').upsert(state,{onConflict:'project_name'}); if(error) throw error }

async function mapLimit<T,R>(items:T[], limit:number, fn:(item:T)=>Promise<R>):Promise<R[]> { const out:R[]=new Array(items.length); let next=0; async function worker(){ while(true){ const i=next++; if(i>=items.length) return; out[i]=await fn(items[i]) } } await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>worker())); return out }

function tarText(bytes:Uint8Array,start:number,length:number){
  const slice=bytes.subarray(start,start+length)
  const zero=slice.indexOf(0)
  return new TextDecoder().decode(zero>=0?slice.subarray(0,zero):slice).trim()
}
function tarOctal(bytes:Uint8Array,start:number,length:number){
  const value=tarText(bytes,start,length).replace(/\0/g,'').trim()
  return value?parseInt(value,8):0
}
function bytesToBase64(bytes:Uint8Array){
  let binary=''
  const size=0x8000
  for(let i=0;i<bytes.length;i+=size)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+size,bytes.length)))
  return btoa(binary)
}
async function fetchCodeloadSnapshot(repoFull:string, commitSha:string){
  const url=`${GITHUB_CODELOAD}/${repoFull}/tar.gz/${encodeURIComponent(commitSha)}`
  const res=await fetch(url,{headers:{'User-Agent':'research-align-deploy-control'}})
  if(!res.ok)throw new Error(`GitHub codeload HTTP ${res.status}`)
  if(!res.body)throw new Error('GitHub codeload returned no body')
  const decompressed=res.body.pipeThrough(new DecompressionStream('gzip'))
  const tar=new Uint8Array(await new Response(decompressed).arrayBuffer())
  const entries:{fullName:string;data:Uint8Array}[]=[]
  let offset=0
  while(offset+512<=tar.length){
    const header=tar.subarray(offset,offset+512)
    if(header.every(byte=>byte===0))break
    const name=tarText(header,0,100)
    const prefix=tarText(header,345,155)
    const fullName=prefix?`${prefix}/${name}`:name
    const size=tarOctal(header,124,12)
    const type=String.fromCharCode(header[156]||48)
    const dataStart=offset+512
    const regular=type==='0'||type==='\u0000'
    if(regular&&fullName)entries.push({fullName,data:tar.slice(dataStart,dataStart+size)})
    offset=dataStart+Math.ceil(size/512)*512
  }
  if(!entries.length)throw new Error('GitHub codeload snapshot contained no files')

  const firstSegments=entries.map(entry=>entry.fullName.split('/')[0]).filter(Boolean)
  const root=firstSegments.length&&firstSegments.every(segment=>segment===firstSegments[0])?`${firstSegments[0]}/`:''
  const files:{file:string;data:string;encoding:'base64'}[]=[]
  for(const entry of entries){
    const path=root&&entry.fullName.startsWith(root)?entry.fullName.slice(root.length):entry.fullName
    if(!path||path.startsWith('node_modules/')||path.startsWith('.next/'))continue
    files.push({file:path,data:bytesToBase64(entry.data),encoding:'base64'})
    if(files.length>400)throw new Error(`Repo has more than 400 files; snapshot limit is 400`)
  }
  if(!files.some(item=>item.file==='package.json'))throw new Error(`Codeload root normalization failed; package.json missing. Root=${root||'(none)'}`)
  return {files,commitSha,commitMessage:'snapshot deploy',authorName:'',authorEmail:''}
}

async function fetchRepoSnapshot(repoFull: string, branch: string, expectedCommitSha?:string|null) {
  if(expectedCommitSha)return fetchCodeloadSnapshot(repoFull,expectedCommitSha)
  const commit = await ghRequest(`/repos/${repoFull}/commits/${encodeURIComponent(branch)}`)
  const tree = await ghRequest(`/repos/${repoFull}/git/trees/${commit.commit.tree.sha}?recursive=1`)
  if (tree.truncated) throw new Error('GitHub tree is truncated; repo too large for snapshot deploy')
  const blobs = (tree.tree || []).filter((x:any)=>x.type==='blob' && !x.path.startsWith('node_modules/') && !x.path.startsWith('.next/'))
  if (blobs.length > 400) throw new Error(`Repo has ${blobs.length} files; snapshot limit is 400`)
  const files = await mapLimit(blobs, 8, async (entry:any) => {
    const blob = await ghRequest(`/repos/${repoFull}/git/blobs/${entry.sha}`)
    if (blob.encoding !== 'base64') throw new Error(`Unsupported GitHub blob encoding for ${entry.path}`)
    return { file: entry.path, data: String(blob.content || '').replace(/\s/g,''), encoding: 'base64' }
  })
  return { files, commitSha: commit.sha, commitMessage: commit.commit?.message || '', authorName: commit.commit?.author?.name || '', authorEmail: commit.commit?.author?.email || '' }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return Response.json({error:'POST only'},{status:405})
    const body=await req.json(); const expected=await getSecret('deploy_control_key')
    if(!expected||body.controlKey!==expected) return Response.json({error:'unauthorized'},{status:401})

    if(body.action==='rotate-vercel-token'){
      const bootstrap=await getSecret('vercel_bootstrap_token'); if(!bootstrap||bootstrap.startsWith('revoked:')) return Response.json({ok:true,alreadyRotated:true})
      const created=await vrequest(bootstrap,'/v3/user/tokens',{method:'POST',body:JSON.stringify({name:'chatgpt-deploy-control'})},false)
      if(!created?.bearerToken) throw new Error('Vercel did not return bearerToken')
      await setSecret('vercel_token',created.bearerToken); let revoked=false
      try{await vrequest(bootstrap,'/v3/user/tokens/current',{method:'DELETE'},false); revoked=true}catch{}
      await setSecret('vercel_bootstrap_token',`revoked:${created?.token?.id||'unknown'}`)
      return Response.json({ok:true,tokenId:created?.token?.id||null,bootstrapRevoked:revoked})
    }

    if(body.action==='set-secret'){
      if(!body.name||typeof body.value!=='string') throw new Error('name/value required')
      await setSecret(body.name,body.value)
      return Response.json({ok:true,name:body.name})
    }

    if(body.action==='apply-project'){
      const token=await getSecret('vercel_token')||await getSecret('vercel_bootstrap_token'); if(!token||token.startsWith('revoked:')) throw new Error('No active Vercel token configured')
      const m=body.manifest||{}; if(!m.name||!m.repo) throw new Error('manifest.name and manifest.repo are required')
      const branch=m.branch||'main', framework=m.framework||'nextjs', publicProduction=m.publicProduction!==false
      let project=await getProject(token,m.name)
      if(!project){
        try{
          project=await vrequest(token,'/v11/projects',{method:'POST',body:JSON.stringify({name:m.name,framework,gitRepository:{type:'github',repo:m.repo},...(m.rootDirectory?{rootDirectory:m.rootDirectory}:{}),...(publicProduction?{ssoProtection:null}:{})})})
        }catch(e:any){
          if(e.status===400||e.status===403){ project=await vrequest(token,'/v11/projects',{method:'POST',body:JSON.stringify({name:m.name,framework,...(m.rootDirectory?{rootDirectory:m.rootDirectory}:{}),...(publicProduction?{ssoProtection:null}:{})})}) } else throw e
        }
      }else{
        const patch:any={framework}; if(m.rootDirectory) patch.rootDirectory=m.rootDirectory; if(publicProduction) patch.ssoProtection=null
        project=await vrequest(token,`/v9/projects/${encodeURIComponent(project.id||m.name)}`,{method:'PATCH',body:JSON.stringify(patch)})
      }
      const env=await resolveEnv(m.env||[]); if(env.length) await vrequest(token,`/v10/projects/${encodeURIComponent(project.id||m.name)}/env?upsert=true`,{method:'POST',body:JSON.stringify(env)})

      const snapshot=await fetchRepoSnapshot(m.repo,branch,m.commitSha||null)
      const deployment=await vrequest(token,'/v13/deployments',{method:'POST',body:JSON.stringify({
        name:m.name, project:project.id||m.name, target:'production', files:snapshot.files,
        gitMetadata:{remoteUrl:`https://github.com/${m.repo}`,commitRef:branch,commitSha:snapshot.commitSha,commitMessage:snapshot.commitMessage,commitAuthorName:snapshot.authorName,commitAuthorEmail:snapshot.authorEmail,ci:true,ciType:'github-actions'},
        projectSettings:{framework,...(m.rootDirectory?{rootDirectory:m.rootDirectory}:{})}
      })})
      const finalDeployment=await waitDeployment(token,deployment.id); const readyState=finalDeployment?.readyState||finalDeployment?.status||finalDeployment?.state||'UNKNOWN'
      let domains:any=null; try{domains=await vrequest(token,`/v9/projects/${encodeURIComponent(project.id||m.name)}/domains`)}catch{}
      const domainNames=Array.isArray(domains?.domains)?domains.domains.map((d:any)=>d.name).filter(Boolean):[]
      const aliases=Array.isArray(finalDeployment?.alias)?finalDeployment.alias:[]
      const productionUrl=domainNames[0]?`https://${domainNames[0]}`:(aliases[0]?`https://${aliases[0]}`:(finalDeployment?.url?`https://${finalDeployment.url}`:null))
      await recordState({project_name:m.name,project_id:project.id||null,repo:m.repo,deployment_id:finalDeployment?.id||deployment.id||null,deployment_url:finalDeployment?.url?`https://${finalDeployment.url}`:null,production_url:productionUrl,status:readyState,details:{teamId:TEAM_ID,teamSlug:TEAM_SLUG,domains:domainNames,aliases,projectName:m.name,commitSha:snapshot.commitSha,errorCode:finalDeployment?.errorCode||null,errorMessage:finalDeployment?.errorMessage||null,directFiles:true,snapshotSource:m.commitSha?'github-codeload':'github-api'},updated_at:new Date().toISOString()})
      return Response.json({ok:readyState==='READY',project:{id:project.id,name:project.name||m.name},deployment:{id:finalDeployment?.id||deployment.id,status:readyState,url:finalDeployment?.url||deployment.url,aliases,errorCode:finalDeployment?.errorCode||null,errorMessage:finalDeployment?.errorMessage||null},productionUrl,domains:domainNames,commitSha:snapshot.commitSha},{status:readyState==='ERROR'?500:200})
    }
    return Response.json({error:'unknown action'},{status:400})
  }catch(e:any){return Response.json({error:e?.message||String(e),status:e?.status||null,data:e?.data||null},{status:500})}
})
