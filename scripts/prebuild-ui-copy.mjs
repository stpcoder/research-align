import fs from 'node:fs'

const file = 'src/app/page.tsx'
let text = fs.readFileSync(file, 'utf8')

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
  ['Google Form처럼 필요한 항목을 자유롭게 쌓습니다. 시간 선택만 scheduling-aware field입니다.', '이름, 연락처, 객관식, 시간 선택 등 필요한 항목을 추가할 수 있습니다.'],
  ['<h2>Responses</h2>', '<h2>신청자</h2>'],
  ['<span className="pill">submitted</span>', '<span className="pill">신청 완료</span>'],
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
])

for (const [from, to] of replacements) text = text.replaceAll(from, to)
fs.writeFileSync(file, text)
