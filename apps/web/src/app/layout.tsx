import type { Metadata } from "next";
export const metadata: Metadata = { title: "SkyNav", description: "Simulation-first UAV delivery operations" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
