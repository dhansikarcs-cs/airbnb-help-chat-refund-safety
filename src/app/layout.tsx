import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guest Support — Refund Safety",
  description: "Stage 1: Supabase guest sign-in and owner-scoped data load.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
