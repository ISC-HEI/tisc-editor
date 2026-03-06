import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  themeColor: "#f8fafc",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "TISC Editor",
  description: "The modern online Typst editor. Write, collaborate, and export high-quality documents to PDF or SVG instantly. The powerful LaTeX alternative for fast and intuitive typesetting",
  keywords: ["Typst", "Editor", "LaTeX alternative", "Collaboration", "Online Editor", "HES", "ISC", "HEI"],
  authors: [{ name: "Adrien Reynard" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
