export type FieldType = 'short' | 'long' | 'email' | 'phone' | 'radio' | 'checkbox' | 'text' | 'availability'
export type FormField = {
  id: string
  type: FieldType
  label: string
  description?: string
  required?: boolean
  options?: string[]
  sessionKey?: string
  sessionLabel?: string
  duration?: number
  stepMinutes?: number
  min?: number
  max?: number | null
  rankTop?: number
  dates?: string[]
  hours?: string
  blockedSlots?: string[]
}
export type Study = {
  id: string
  owner_id: string
  title: string
  slug: string
  description: string
  status: 'draft' | 'published' | 'closed'
  form_config: { fields: FormField[] }
  scheduling_config: Record<string, unknown>
  created_at: string
}
export type ResponseRow = {
  id: string
  study_id: string
  answers: Record<string, string | string[]>
  availability: Record<string, string[]>
  preferences: Record<string, Record<string, string>>
  contact_email?: string | null
  contact_phone?: string | null
  submitted_at: string
}
