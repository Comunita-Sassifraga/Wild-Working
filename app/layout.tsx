import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Intestazione } from "@/components/Intestazione";
import { PieDiPagina } from "@/components/PieDiPagina";
import { m } from "@/lib/messaggi";
import { inclusiveSans } from "./font";
import "./globals.css";

export const metadata: Metadata = { title: m.app.nome };

// Root layout — SPEC §13.8: header and footer carry the continuity with the
// institutional site; pages render inside a single text column.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it" className={inclusiveSans.variable}>
      <body className="flex min-h-dvh flex-col">
        <Intestazione />
        <main className="mx-auto w-full max-w-contenuto flex-1 px-4 py-10">{children}</main>
        <PieDiPagina />
      </body>
    </html>
  );
}
