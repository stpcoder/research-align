import fs from 'node:fs'

const file='src/app/page.tsx'
let text=fs.readFileSync(file,'utf8')

const typeImport="import type { FormField, ResponseRow, Study } from '@/lib/types'"
const imports=[
  "import FormBuilderUnified from '@/components/FormBuilderUnified'",
  "import ResponseManagerUnified from '@/components/ResponseManagerUnified'",
  "import ScheduleUnified from '@/components/ScheduleUnified'",
  "import ContactManager from '@/components/ContactManager'",
  "import ResearchHome from '@/components/ResearchHome'",
]
for(const statement of imports)if(!text.includes(statement))text=text.replace(typeImport,`${typeImport}\n${statement}`)

function replaceBetween(source,startMarker,endMarker,replacement){const start=source.indexOf(startMarker);if(start<0)return source;const end=source.indexOf(endMarker,start);if(end<0)return source;return source.slice(0,start)+replacement+source.slice(end)}

text=replaceBetween(text,'function FormBuilder(','function Responses(',`function FormBuilder({study,refresh}:{study:Study,refresh:()=>Promise<void>}){return <FormBuilderUnified study={study} refresh={refresh}/>}\n`)
text=replaceBetween(text,'function Responses(','function Schedule(',`function Responses({study}:{study:Study}){return <ResponseManagerUnified study={study}/>}\n`)
text=replaceBetween(text,'function Schedule(','function ContactHub(',`function Schedule({study}:{study:Study}){return <ScheduleUnified study={study}/>}\n`)
text=text.replaceAll('<ContactHub study={study}/>','<ContactManager study={study}/>')

const studyReturn=text.indexOf('if(study)return')
const homeStart=studyReturn>=0?text.indexOf(' return <div className="shell">',studyReturn):-1
const workspaceStart=homeStart>=0?text.indexOf('\n}\nfunction StudyWorkspace',homeStart):-1
if(homeStart>=0&&workspaceStart>=0)text=text.slice(0,homeStart)+` return <ResearchHome user={user} studies={studies} setStudy={setStudy} setTab={setTab} loadStudies={loadStudies}/>`+text.slice(workspaceStart)

const replacements=new Map([
  ['Research operations, without the spreadsheet.','실험 운영을 한 곳에서 관리하세요.'],
  ['연구자는 각자 로그인하고 자신의 여러 실험만 관리합니다.','참가자 모집, 신청서 작성, 일정 조율, 연락까지 한 곳에서 관리할 수 있습니다.'],
  ['← 내 연구','← 실험 목록'],
  ["const tabs=[['form','Form'],['responses','Responses'],['schedule','Schedule'],['contact','Contact Hub']]","const tabs=[['form','신청서'],['responses','신청자'],['schedule','일정'],['contact','연락']]"],
  ["study.status==='published'?'모집 중지':'Publish'","study.status==='published'?'모집 중지':study.status==='closed'?'모집 재개':'모집 시작'"],
])
for(const[from,to]of replacements)text=text.replaceAll(from,to)

const swStart=text.indexOf('function StudyWorkspace(')
const swEnd=swStart>=0?text.indexOf('\nfunction FormBuilder(',swStart):-1
if(swStart>=0&&swEnd>=0){
  let workspace=text.slice(swStart,swEnd)
  const oldToggle=" async function togglePublish(){const {data,error}=await supabase.from('studies').update({status:study.status==='published'?'draft':'published'}).eq('id',study.id).select().single();if(error)alert(error.message);else setStudy(data as Study)}"
  const nextToggle=" async function saveDirtyFormBeforePublish(){if(!(window as any).__studyFormDirty)return true;const saveForm=(window as any).__studyFormSave;if(typeof saveForm!=='function'){alert('변경사항 저장 기능을 준비하지 못했습니다. 신청서 탭에서 다시 시도해주세요.');return false}await saveForm();for(let i=0;i<60&&(window as any).__studyFormDirty;i++)await new Promise(resolve=>setTimeout(resolve,50));if((window as any).__studyFormDirty){alert('변경사항이 저장되지 않아 모집을 시작하지 않았습니다. 입력 내용을 확인한 뒤 다시 시도해주세요.');return false}return true}\n async function togglePublish(){if(study.status!=='published'&&!(await saveDirtyFormBeforePublish()))return;const nextStatus=study.status==='published'?'closed':'published';const {data,error}=await supabase.from('studies').update({status:nextStatus}).eq('id',study.id).select().single();if(error)alert(error.message);else setStudy(data as Study)}"
  workspace=workspace.replace(oldToggle,nextToggle)
  const anchor=' async function saveDirtyFormBeforePublish()'
  if(workspace.includes(anchor)&&!workspace.includes('function confirmDirtyLeave'))workspace=workspace.replace(anchor,` function confirmDirtyLeave(){return !(window as any).__studyFormDirty||confirm('저장되지 않은 변경사항이 있습니다. 저장하지 않고 이동할까요?')}\n function leaveStudy(){if(confirmDirtyLeave())setStudy(null)}\n function switchTab(next:string){if(next===tab||confirmDirtyLeave())setTab(next)}\n${anchor}`)
  workspace=workspace.replaceAll('onClick={()=>setStudy(null)}','onClick={leaveStudy}')
  workspace=workspace.replaceAll('onClick={()=>setTab(k)}','onClick={()=>switchTab(k)}')
  text=text.slice(0,swStart)+workspace+text.slice(swEnd)
}
fs.writeFileSync(file,text)

// Expose the current Form Builder save operation to the workspace publish action.
const formFile='src/components/FormBuilderUnified.tsx'
let form=fs.readFileSync(formFile,'utf8')
if(!form.includes('__studyFormSave=save'))form=form.replace(
  '  function patch(value:Partial<FormField>){',
  "  useEffect(()=>{(window as any).__studyFormSave=save;return()=>{if((window as any).__studyFormSave===save)delete (window as any).__studyFormSave}})\n\n  function patch(value:Partial<FormField>){"
)
fs.writeFileSync(formFile,form)

// Enforce a clear stop-before-delete lifecycle on the researcher home screen.
const homeFile='src/components/ResearchHome.tsx'
let home=fs.readFileSync(homeFile,'utf8')
home=home.replace(
  "  const[deletingId,setDeletingId]=useState<string|null>(null)",
  "  const[deletingId,setDeletingId]=useState<string|null>(null)\n  const[stoppingId,setStoppingId]=useState<string|null>(null)"
)
if(!home.includes('async function stopStudy(study:Study)'))home=home.replace(
  '  async function deleteStudy(study:Study){\n    if(deletingId)return',
  "  async function stopStudy(study:Study){\n    if(stoppingId)return\n    if(!window.confirm(`“${study.title}” 참가자 모집을 중지할까요?\\n\\n중지하면 참가자 페이지에서 더 이상 신청할 수 없고, 이후 실험을 삭제할 수 있습니다.`))return\n    setStoppingId(study.id)\n    const{error}=await supabase.from('studies').update({status:'closed'}).eq('id',study.id)\n    if(error)alert(error.message)\n    else await loadStudies()\n    setStoppingId(null)\n  }\n  async function deleteStudy(study:Study){\n    if(study.status==='published'){alert('모집 중인 실험은 먼저 모집을 중지한 뒤 삭제해주세요.');return}\n    if(deletingId)return"
)
home=home.replace(
  '<button className="btn ghost small rh-delete" disabled={deletingId===study.id} onClick={()=>deleteStudy(study)}>{deletingId===study.id?\'삭제 중…\':\'삭제\'}</button>',
  "{study.status==='published'?<button className=\"btn ghost small rh-delete\" disabled={stoppingId===study.id} onClick={()=>stopStudy(study)}>{stoppingId===study.id?'중지 중…':'모집 중지'}</button>:<button className=\"btn ghost small rh-delete\" disabled={deletingId===study.id} onClick={()=>deleteStudy(study)}>{deletingId===study.id?'삭제 중…':'삭제'}</button>}"
)
fs.writeFileSync(homeFile,home)

// Keep the date-window header type-safe before Next.js type checking.
const scheduleFile='src/components/ScheduleUnified.tsx'
let schedule=fs.readFileSync(scheduleFile,'utf8')
schedule=schedule.replaceAll('visibleDates.at(-1)&&fmtDay(visibleDates.at(-1))','visibleDates.length>0&&fmtDay(visibleDates[visibleDates.length-1])')
fs.writeFileSync(scheduleFile,schedule)
