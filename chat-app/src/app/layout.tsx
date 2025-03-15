import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/components/theme-provider'
import { VideoCallProvider } from '@/contexts/VideoCallContext'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <VideoCallProvider>
              {children}
            </VideoCallProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
