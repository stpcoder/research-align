import ParticipantForm from '@/components/ParticipantForm'
export default async function PublicStudyPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <ParticipantForm slug={slug}/>} 
