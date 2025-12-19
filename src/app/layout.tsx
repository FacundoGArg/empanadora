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

export const metadata: Metadata = {
  title: "EmpanaDora",
  description: "Haz tu pedido de empanadas de manera rápida y sencilla.",
  openGraph: {
    title: "EmpanaDora",
    description: "Haz tu pedido de empanadas de manera rápida y sencilla.",
    type: "website",
    images: [
      {
        url: "/images/menu/og-image.jpg",
        alt: "EmpanaDora",
      },
    ],
  },
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
