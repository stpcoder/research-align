import type { Metadata } from 'next'
import './globals.css'
import './workspace.css'
import './availability-editor.css'
import './admin-unified.css'
import './form-controls.css'
import './schedule-planner.css'
import './participant-booking.css'
import './public-inquiry.css'
import './ui-polish.css'
import './ops-enhancements.css'
import './admin-foundation.css'

export const metadata: Metadata = { title: 'StudyForm', description: 'Human-subject study scheduling and participant operations' }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>
}
