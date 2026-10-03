import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/Nav";
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
  title: "Lost Ark Tracker",
  description: "Track raids, dailies, weeklies and gold across your roster",
};

// Matches usePreference("theme") in ThemeToggle: values are stored as JSON.
const THEME_SCRIPT = `(function(){try{var t=JSON.parse(localStorage.getItem("lost-ark-tracker:theme"));if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The script below may set data-theme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        {/* Apply a saved Light/Dark choice before the first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
