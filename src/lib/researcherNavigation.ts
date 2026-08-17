export type ResearcherTab='responses'|'schedule'|'contact'

export function participantFromUrl(){
  if(typeof window==='undefined')return null
  return new URL(window.location.href).searchParams.get('participant')
}

export function setParticipantInUrl(participantId:string){
  if(typeof window==='undefined')return
  const url=new URL(window.location.href)
  url.searchParams.set('participant',participantId)
  window.history.replaceState(window.history.state,'',url)
}

export function clearParticipantInUrl(){
  if(typeof window==='undefined')return
  const url=new URL(window.location.href)
  url.searchParams.delete('participant')
  window.history.replaceState(window.history.state,'',url)
}

export function navigateResearcher(tab:ResearcherTab,participantId?:string|null){
  if(typeof window==='undefined')return
  if(participantId)setParticipantInUrl(participantId)
  window.dispatchEvent(new CustomEvent('studyform:navigate',{detail:{tab,participantId:participantId||null}}))
}
