import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teamly - Secure Team Task Management Platform",
  description: "Secure, role-based task and workspace management with verified access control.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}

