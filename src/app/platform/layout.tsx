import type { Metadata } from "next";

import { Navbar } from "@/components/navigation/navbar";

export const metadata: Metadata = {
  title: "EmpanaDora Platform",
  description: "Administra tu plataforma de pedidos y conversaciones con clientes de manera eficiente.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
      >
        <Navbar />
        {children}
      </body>
    </html>
  );
}
