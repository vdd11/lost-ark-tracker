import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import Nav from "@/components/Nav";
import ResetReminders from "@/components/ResetReminders";
import { ToastProvider } from "@/components/Toast";
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
const THEME_SCRIPT = `(function(){try{var d=document.documentElement,g=function(k){return JSON.parse(localStorage.getItem("lost-ark-tracker:"+k))};var t=g("theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);var s=g("text-size");if(s==="small"||s==="large")d.setAttribute("data-text-size",s);var n=g("density");if(n==="compact")d.setAttribute("data-density",n)}catch(e){}})()`;

// Typed by hand rather than with the generated LayoutProps<"/">, so
// `tsc --noEmit` works on a fresh checkout before `next build` has run.
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The script below may set data-theme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        {/* Apply the saved theme, text size and density before the first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <KeyboardShortcuts>
            <Nav />
            <ResetReminders />
            <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6">{children}</main>
          </KeyboardShortcuts>
        </ToastProvider>
      </body>
    </html>
  );
}
