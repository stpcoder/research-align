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

function replaceBetween(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker)
  if (start < 0) return source
  const end = source.indexOf(endMarker, start)
  if (end < 0) return source
  return source.slice(0, start) + replacement + source.slice(end)
}

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
  ['<label>연구 제목', '<label>실험 제목'],
  ['Google Form처럼 필요한 항목을 자유롭게 쌓습니다. 시간 선택만 scheduling-aware field입니다.', '이름, 연락처, 객관식, 시간 선택 등 필요한 문항을 추가할 수 있습니다.'],
  ['Study contact identity', '연구용 이메일'],
  ['연구별 KeyID identity를 Next.js backend에서만 사용합니다. 개인 연구자의 메일/전화번호는 참가자에게 노출되지 않습니다.', '참가자 연락에 사용할 연구 전용 이메일입니다. 연구자의 개인 이메일 주소는 참가자에게 공개되지 않습니다.'],
  ['KeyID 연구용 주소 연결', '연구용 이메일 연결'],
  ['<b>연구용 연락처</b> · email', '<b>연구용 이메일</b> ·'],
  ['아직 KeyID identity가 연결되지 않았습니다. 이메일 발신/수신을 사용하려면 위 버튼으로 연결하세요.', '아직 연구용 이메일이 연결되지 않았습니다. 위 버튼을 눌러 연결하면 이 화면에서 참가자와 이메일을 주고받을 수 있습니다.'],
  ['새 연락 thread', '새 연락'],
  ['설문에서 참가자가 직접 제출한 연락처만 대상으로 thread를 엽니다.', '참가자가 신청서에 입력한 이메일 또는 전화번호로 연락할 수 있습니다.'],
  ['Thread 만들기', '연락 시작'],
  ['문의 / 연락', '참가자 연락'],
  ['KeyID email은 Next.js server route에서 발송되고, 답장은 webhook으로 이 thread에 들어옵니다.', '보낸 이메일과 참가자의 답장이 이 화면에 함께 기록됩니다.'],
  ['SMS thread — inbound 수신 기록용', 'SMS 메시지'],
  ['최신 KeyID는 persistent phone/SMS inbox를 지원하지만 공개 JS SDK의 outbound SMS 메서드가 아직 확인되지 않아 이 빌드에서는 수신 thread만 안전하게 연결합니다.', '현재 SMS는 참가자 연락처를 기록하고 수신 내역을 확인하는 용도로 사용합니다.'],
  ["const fieldTypes:[FormField['type'],string][]=[['short','단답형'],['long','장문형'],['email','이메일'],['phone','전화번호'],['radio','객관식'],['checkbox','체크박스'],['text','설명'],['availability','시간 선택']]", "const fieldTypes:[FormField['type'],string][]=[['short','짧은 답변'],['long','긴 답변'],['email','이메일'],['phone','전화번호'],['radio','객관식'],['checkbox','복수 선택'],['text','안내문'],['availability','시간 선택']]"],
  ["function freshFields():FormField[]{return [{id:id(),type:'short',label:'이름',required:true},{id:id(),type:'email',label:'이메일',required:true},{id:id(),type:'phone',label:'전화번호',description:'일정 변경이 필요한 경우에만 사용합니다.',required:false},{id:id(),type:'radio',label:'선호 연락 수단',options:['이메일','SMS'],required:true},{id:id(),type:'availability',label:'참여 가능한 시간을 선택해주세요',sessionKey:'session-1',sessionLabel:'본 실험',duration:60,stepMinutes:30,min:3,rankTop:3,dates:[],hours:'10:00-18:00',required:true}]}", "function freshFields():FormField[]{return [{id:id(),type:'short',label:'이름',required:true},{id:id(),type:'email',label:'이메일',description:'일정 안내를 받을 이메일을 입력해주세요.',required:true},{id:id(),type:'phone',label:'전화번호',description:'문자 안내가 필요한 경우 입력해주세요.',required:false},{id:id(),type:'availability',label:'참여 가능한 시간을 선택해주세요',sessionKey:'session-1',sessionLabel:'본 실험',duration:60,stepMinutes:30,min:3,rankTop:3,dates:[],hours:'10:00-18:00',required:true}]}"],
  ["<label>옵션<textarea value={(f.options||[]).join('\\n')}", "<label>선택지 (한 줄에 하나씩)<textarea value={(f.options||[]).join('\\n')}"],
  ["{options:['옵션 1','옵션 2']}", "{options:['선택지 1','선택지 2']}"],
])

for (const [from, to] of replacements) text = text.replaceAll(from, to)

fs.writeFileSync(file, text)
