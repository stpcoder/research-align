import ParticipantForm from '@/components/ParticipantForm'
import PublicInquiryWidget from '@/components/PublicInquiryWidget'

export default async function PublicStudyPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params
  return <><ParticipantForm slug={slug}/><PublicInquiryWidget slug={slug}/></>
}
