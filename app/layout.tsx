// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Fonts
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadata
export const metadata: Metadata = {
  title: "LeetCode Mock Interviewer",
  description: "AI-powered coding interview simulator built by Keerthana Sathyakumar.",
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "LeetCode Mock Interviewer",
    description: "A FAANG-style mock interview experience powered by AI.",
    url: "https://your-domain.com",
    siteName: "Leetcode Mock Interviewer",
    images: [
      {
        url: "/preview.png",
        width: 1200,
        height: 630,
        alt: "Leetcode Mock Interviewer Preview",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LeetCode Mock Interviewer",
    description: "AI-powered mock interview built by Keerthana Sathyakumar.",
    images: ["/preview.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`
          ${geistSans.variable} 
          ${geistMono.variable} 
          antialiased 
          bg-[#F7F7F7] 
          text-[#1E1E1E]
          min-h-screen
          flex flex-col
        `}
      >
        {/* Main Content */}
        <main className="flex-1">{children}</main>

<footer className="py-6 text-center text-sm text-gray-600 border-t bg-white">
  <p>
    Engineered by 
    <span className="font-semibold text-gray-800"> Keerthana Sathyakumar</span>
  </p>
</footer>


      </body>
    </html>
  );
}
