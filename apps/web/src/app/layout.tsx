import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkyNav | Autonomous Drone Delivery Platform",
  description: "Industry-grade simulation-first UAV delivery operations and logistics management."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" className="dark">
      <body className="bg-[#070b14] text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
