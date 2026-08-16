import fs from 'node:fs'

const file = 'src/app/page.tsx'
let text = fs.readFileSync(file, 'utf8')

const typeImport = "import type { FormField, ResponseRow, Study } from '@/lib/types'"
if (!text.includes("import ResponseManager from '@/components/ResponseManager'")) {
  text = text.replace(typeImport, `${typeImport}\nimport ResponseManager from '@/components/ResponseManager'`)
}
if (!text.includes("import ScheduleManager from '@/components/ScheduleManager'")) {
  text = text.replace("import ResponseManager from '@/components/ResponseManager'", "import ResponseManager from '@/components/ResponseManager'\nimport ScheduleManager from '@/components/ScheduleManager'")
}
if (!text.includes("import ContactManager from '@/components/ContactManager'")) {
  text = text.replace("import ScheduleManager from '@/components/ScheduleManager'", "import ScheduleManager from '@/components/ScheduleManager'\nimport ContactManager from '@/components/ContactManager'")
}
if (!text.includes("import FormBuilderManager from '@/components/FormBuilderManager'")) {
  text = text.replace("import ContactManager from '@/components/ContactManager'", "import ContactManager from '@/components/ContactManager'\nimport FormBuilderManager from '@/components/FormBuilderManager'")
}

function replaceBetween(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker)
  if (start < 0) return source
  const end = source.indexOf(endMarker, start)
  if (end < 0) return source
  return source.slice(0, start) + replacement + source.slice(end)
}

text = replaceBetween(
  text,
  'function FormBuilder(',
  'function Responses(',
  `function FormBuilder({study,refresh}:{study:Study,refresh:()=>Promise<void>}){return <FormBuilderManager study={study} refresh={refresh}/>}\n`,
)
text = replaceBetween(
  text,
  'function Responses(',
  'function Schedule(',
  `function Responses({study}:{study:Study}){return <ResponseManager study={study}/>}\n`,
)
text = replaceBetween(
  text,
  'function Schedule(',
  'function ContactHub(',
  `function Schedule({study}:{study:Study}){return <ScheduleManager study={study}/>}\n`,
)
text = text.replaceAll('<ContactHub study={study}/>', '<ContactManager study={study}/>')

const replacements = new Map([
  ['Research operations, without the spreadsheet.', '실험 운영을 한 곳에서 관리하세요.'],
  ['연구자는 각자 로그인하고 자신의 여러 실험만 관리합니다.', '참가자 모집, 신청서 작성, 일정 조율, 연락까지 한 곳에서 관리할 수 있습니다.'],
  ['<h1>내 연구</h1><p className="muted">한 연구자 계정에서 여러 실험을 독립적으로 운영합니다.</p>', '<h1>실험 관리</h1><p className="muted">진행 중인 실험을 만들고 참가자 신청과 일정을 관리하세요.</p>'],
  ['샘플 연구 만들기', '샘플 실험 보기'],
  ['+ 새 연구', '+ 새 실험'],
  ["title:'새 연구'", "title:'새 실험'"],
  ['← 내 연구', '← 실험 목록'],
  ["const tabs=[['form','Form'],['responses','Responses'],['schedule','Schedule'],['contact','Contact Hub']]", "const tabs=[['form','신청서'],['responses','신청자'],['schedule','일정'],['contact','연락']]"],
  ["study.status==='published'?'모집 중지':'Publish'", "study.status==='published'?'모집 중지':'모집 시작'"],
])

for (const [from, to] of replacements) text = text.replaceAll(from, to)
fs.writeFileSync(file, text)

const cssFile='src/app/globals.css'
let css=fs.readFileSync(cssFile,'utf8')
const imports=["@import './workspace.css';\n","@import './availability-editor.css';\n","@import './form-builder.css';\n","@import './admin-ux.css';\n"]
for(const cssImport of [...imports].reverse()) if(!css.includes(cssImport.trim())) css=cssImport+css
fs.writeFileSync(cssFile,css)
