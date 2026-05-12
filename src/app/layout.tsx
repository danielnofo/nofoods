import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "FOODOS",
  description: "Sistema operacional para restaurantes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0, background: "#111", minHeight: "100vh", display: "flex" }}>
        <Nav />
        <main style={{ flex: 1, marginLeft: 220, minHeight: "100vh" }}>
          {children}
        </main>
      </body>
    </html>
  );
}