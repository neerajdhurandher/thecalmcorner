import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Calm Corner',
  description: 'A little green. A little glow. A lot of calm.',
}

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
