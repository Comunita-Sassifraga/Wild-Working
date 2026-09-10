import type { ReactNode } from "react";
import "./globals.css";

// Root layout only. No screen exists yet: screens start at step 4 of
// SPEC §12, after the visual tokens are wired into Tailwind (step 3).
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
