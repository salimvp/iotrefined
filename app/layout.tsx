import type { Metadata, Viewport } from "next";
import "./globals.css";
import { HomeProvider } from "@/lib/store";
import { AppShell } from "@/components/ui/efferd-dashboard-2-utils/app-shell";

export const metadata: Metadata = {
  title: "AIoT Smart Home — A Home That Thinks, Protects & Automates",
  description:
    "Real-time ESP32 Smart Home System with autonomous local fail-safe execution, Supabase Realtime synchronization, and AI Assistant.",
  applicationName: "AuraHome AIoT",
};

export const viewport: Viewport = {
  themeColor: "#05070f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans bg-background text-foreground">
        <HomeProvider>
          <AppShell>{children}</AppShell>
        </HomeProvider>
      </body>
    </html>
  );
}
