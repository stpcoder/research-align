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
if(homeStart>=0&&workspaceStart>=0){
  text=text.slice(0,homeStart)+` return <ResearchHome user={user} studies={studies} setStudy={setStudy} setTab={setTab} loadStudies={loadStudies}/>`+text.slice(workspaceStart)
}

const replacements=new Map([
  ['Research operations, without the spreadsheet.','실험 운영을 한 곳에서 관리하세요.'],
  ['연구자는 각자 로그인하고 자신의 여러 실험만 관리합니다.','참가자 모집, 신청서 작성, 일정 조율, 연락까지 한 곳에서 관리할 수 있습니다.'],
  ['← 내 연구','← 실험 목록'],
  ["const tabs=[['form','Form'],['responses','Responses'],['schedule','Schedule'],['contact','Contact Hub']]","const tabs=[['form','신청서'],['responses','신청자'],['schedule','일정'],['contact','연락']]"],
  ["study.status==='published'?'모집 중지':'Publish'","study.status==='published'?'모집 중지':'모집 시작'"],
])
for(const[from,to]of replacements)text=text.replaceAll(from,to)
fs.writeFileSync(file,text)
