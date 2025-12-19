import Image from "next/image";
import Link from "next/link";

const navLinks = [
  { href: "/platform/chats", label: "Chats" },
  { href: "/platform/orders", label: "Órdenes" },
  { href: "/platform/menu", label: "Menú" },
  { href: "/platform/inventory", label: "Inventario" },
];

export const Navbar = async function () {
  return (
    <header className="sticky top-0 z-50 bg-[#fffaf0] w-full border-b px-4 md:px-6">
      <div className="flex h-16 items-center justify-between gap-4">
        <div className="flex flex-1 items-center justify-between gap-4">

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
        </div>
      </div>
    </header>
  );
};
