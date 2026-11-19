import React from 'react';
import {
  BookOpen,
  Calendar,
  Compass,
  Lock,
  Moon,
  PenLine,
  Settings,
  Sun,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export type NavTab = 'today' | 'calendar' | 'journal' | 'prompts' | 'settings';

interface LayoutProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'today', label: 'Today', icon: PenLine },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'journal', label: 'Entries', icon: BookOpen },
  { id: 'prompts', label: 'Questions', icon: Compass },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const { logout, status } = useAuth();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r px-4 py-6"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-2.5 px-2 mb-8">
          <img src="/icon.svg" alt="Meridian" className="h-8 w-8 rounded-lg" />
          <div>
            <div className="text-base font-bold tracking-tight leading-none">Meridian</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {status?.displayName ? `${status.displayName}'s Journal` : 'Personal Journal'}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition"
                style={{
                  backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div
          className="mt-auto space-y-1 border-t pt-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition hover:opacity-85"
            style={{ color: 'var(--text-muted)' }}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Warm Paper Mode' : 'Dark Charcoal Mode'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition hover:opacity-85"
            style={{ color: 'var(--text-muted)' }}
          >
            <Lock className="h-4 w-4" />
            Lock Journal
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 md:hidden backdrop-blur-md"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-2">
          <img src="/icon.svg" alt="Meridian" className="h-7 w-7 rounded-md" />
          <span className="font-bold tracking-tight">Meridian</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg p-2"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg p-2"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Lock journal"
          >
            <Lock className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 md:pl-60 pb-24 md:pb-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">{children}</div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t pt-2 pb-safe md:hidden"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium"
              style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
