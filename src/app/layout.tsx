import type { Metadata } from 'next'
import './globals.css'
import './workspace.css'
import './availability-editor.css'
import './admin-unified.css'
import './form-controls.css'
import './schedule-planner.css'
import './participant-booking.css'
import './google-calendar.css'

export const metadata: Metadata = { title: 'StudyForm', description: 'Human-subject study scheduling and participant operations' }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>
}
