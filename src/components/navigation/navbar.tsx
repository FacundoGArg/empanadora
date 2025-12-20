"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useCallback, useRef } from "react";

const navLinks = [
  { href: "/platform", label: "Dashboard" },
  { href: "/platform/chats", label: "Chats" },
  { href: "/platform/orders", label: "Órdenes" },
  { href: "/platform/menu", label: "Menú" },
  { href: "/platform/inventory", label: "Inventario" },
];

export const Navbar = function () {
  const mobileMenuRef = useRef<HTMLDetailsElement | null>(null);
  const closeMobileMenu = useCallback(() => {
    if (mobileMenuRef.current) {
      mobileMenuRef.current.open = false;
    }
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#fffaf0] w-full border-b px-4 md:px-6">
      <div className="relative flex h-16 items-center justify-between gap-4">
        <Link href="/platform">
          <Image
            src="/logo.svg"
            alt="Empanadora Logo"
            width={160}
            height={40}
            priority
          />
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-amber-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <details className="group md:hidden" ref={mobileMenuRef}>
          <summary className="list-none rounded-md border border-gray-200 p-2 text-gray-700 shadow-sm transition hover:text-amber-600">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menú</span>
          </summary>
          <div className="absolute right-0 top-18 w-52 rounded-md border border-gray-200 bg-[#fffaf0] p-2 shadow-lg">
            <nav className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-2 transition hover:bg-amber-50 hover:text-amber-600"
                  onClick={closeMobileMenu}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
};
