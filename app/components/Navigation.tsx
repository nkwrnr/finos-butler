'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/bills', label: 'Bills' },
  { href: '/reports', label: 'Reports' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/zcash', label: 'Zcash' },
  { href: '/chat', label: 'Chat' },
];

const SECONDARY_LINKS = [
  { href: '/import', label: 'Import' },
  { href: '/settings', label: 'Settings' },
];

export default function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="border-b border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          Butler
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <div className="flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`transition ${
                  isActive(link.href)
                    ? 'text-primary'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-6">
            {SECONDARY_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`transition ${
                  isActive(link.href)
                    ? 'text-primary'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 -mr-2 text-secondary hover:text-primary transition"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            // X icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            // Hamburger icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-surface">
          <div className="px-4 py-4 space-y-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className={`block py-3 px-3 rounded-lg transition ${
                  isActive(link.href)
                    ? 'bg-elevated text-primary'
                    : 'text-secondary hover:text-primary hover:bg-elevated'
                }`}
              >
                {link.label}
              </a>
            ))}
            <div className="border-t border-border my-2" />
            {SECONDARY_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className={`block py-3 px-3 rounded-lg transition ${
                  isActive(link.href)
                    ? 'bg-elevated text-primary'
                    : 'text-secondary hover:text-primary hover:bg-elevated'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
