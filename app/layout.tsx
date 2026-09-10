import type { Metadata } from "next";
import type { ReactNode } from "react";
import { m } from "@/lib/messaggi";
import "./globals.css";

export const metadata: Metadata = { title: m.app.nome };

// Root layout only. The sign-in pages of step 2 are unstyled: screens are
// dressed from step 3 of SPEC §12, once the visual tokens are wired into
// Tailwind.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
