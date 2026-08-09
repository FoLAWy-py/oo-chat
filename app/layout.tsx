import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "oo-chat - Open Source Chat Client",
  description: "An open-source chat client powered by ConnectOnion",
}

export default function RootLayout({
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
