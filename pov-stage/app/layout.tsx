import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'POV.STAGE — Lighting Control',
  description: 'Premium event lighting control dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
