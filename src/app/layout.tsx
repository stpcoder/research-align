import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'StudyForm', description: 'Human-subject study scheduling and participant operations' }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>
}
