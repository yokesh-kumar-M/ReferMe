import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReferMe — Free AI Job Outreach Platform",
  description: "Stop clicking Apply. Let AI pitch you directly to hiring managers — for free. No paywalls, no credit limits. Craft referral requests, cold emails, cover letters, and custom CVs instantly.",
  keywords: ["job outreach", "referral request", "cover letter generator", "AI resume", "LinkedIn outreach", "free job tool"],
  openGraph: {
    title: "ReferMe — Free AI Job Outreach Platform",
    description: "Bypass the ATS black hole. AI-powered outreach emails, cover letters, and custom CVs — 100% free.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
    >
      <body className="min-h-full bg-zinc-100 flex items-center justify-center m-0 p-0 text-zinc-900 font-sans">
        {children}
      </body>
    </html>
  );
}
