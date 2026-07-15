'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Icon, IconName } from './ui/Icon';
import { useAuth } from '@/lib/auth';

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/stock', label: 'Stock', icon: 'layers' },
  { href: '/movements', label: 'Movimentos', icon: 'arrows' },
  { href: '/admin', label: 'Administração', icon: 'settings', adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAdmin, logout } = useAuth();

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const navContent = (
    <>
      <div className="flex items-center gap-3 px-6 py-5">
      <div className="flex h-10 w-10 items-center justify-center">
        <Image
          src="/logonickel.png"
          alt="Nickel Stock"
          width={44}
          height={44}
          priority
      />
</div>
        <div>
          <p className="text-sm font-bold text-white">Nickel Stock</p>
          <p className="text-xs text-ink-400">Gestão de Stock</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {visibleItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-ink-300 hover:bg-ink-800 hover:text-white'
              }`}
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-ink-800 px-3 py-4">
        {user && (
          <div className="mb-2 px-3 py-2">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-ink-400">
              {isAdmin ? 'Administrador' : 'Operador'}
            </p>
          </div>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-white"
        >
          <Icon name="logout" size={20} />
          Terminar sessão
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center">
            <Image
              src="/logonickel.png"
              alt="Nickel Stock"
              width={36}
              height={36}
              priority
        />
</div>
          <span className="text-sm font-bold text-ink-900">Nickel Stock</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-100"
          aria-label="Abrir menu"
        >
          <Icon name="menu" size={22} />
        </button>
      </div>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-ink-950 animate-fade-in">
            {navContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 hidden h-full w-64 flex-col bg-ink-950 lg:flex">
        {navContent}
      </aside>
    </>
  );
}
