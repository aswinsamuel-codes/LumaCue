import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LumaCue — Lighting Control',
  description: 'LED dance show control — powered by Aswin Samuel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
