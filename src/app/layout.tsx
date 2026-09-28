import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { connection } from "next/server";
import { TopBar } from "@/components/shell/TopBar";
import { ConfigError, getConfig } from "@/lib/config";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "365 Flow Watcher",
  description: "Watch, audit and secure Power Automate flows across your Microsoft 365 tenant.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f1216" },
    { media: "(prefers-color-scheme: light)", color: "#f8f9fb" },
  ],
};

// Runs before paint so the saved theme never flashes. Dark is the default.
const themeScript = `try{var t=localStorage.getItem("theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();

  let mode: "demo" | "live" | null = null;
  try {
    mode = getConfig().mode;
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
  }

  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <TopBar mode={mode} />
        {children}
      </body>
    </html>
  );
}
