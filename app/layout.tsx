import type { Metadata, Viewport } from 'next'
import { Noto_Sans_JP, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const _notoSansJP = Noto_Sans_JP({ subsets: ["latin"], variable: "--font-sans" });
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: 'FitCalc - フィットネスジム出店試算',
  description: 'フィットネスジム店舗の出店コスト・収益をシミュレーションする試算ツール',
}

export const viewport: Viewport = {
  themeColor: '#3b5adb',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className={`${_notoSansJP.variable} ${_geistMono.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors />
        <Analytics />
      </body>
    </html>
  )
}
