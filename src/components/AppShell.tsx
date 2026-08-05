import { Apple, BarChart3, CircleUserRound, LibraryBig } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { AppMark } from './AppMark';

export type AppTab = 'today' | 'progress' | 'foods' | 'you';

const tabs: Array<{
  id: AppTab;
  label: string;
  icon: typeof Apple;
}> = [
  { id: 'today', label: 'Today', icon: Apple },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'foods', label: 'Foods', icon: LibraryBig },
  { id: 'you', label: 'You', icon: CircleUserRound },
];

export function AppShell({
  tab,
  onTabChange,
  user,
  displayName,
  children,
}: {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  user: { image?: string | null; name: string };
  displayName: string;
  children: ReactNode;
}) {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <AppMark />
        <div className="header-actions">
          <button
            className="avatar-button"
            type="button"
            aria-label={`Open ${displayName}'s settings`}
            onClick={() => onTabChange('you')}
          >
            {user.image ? <img src={user.image} alt="" /> : displayName.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>
      {!online ? (
        <p className="offline-banner" role="status">
          Offline — changes will sync when you reconnect.
        </p>
      ) : null}

      <div className="shell-body">
        <nav className="desktop-nav" aria-label="Primary">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={tab === item.id ? 'nav-item is-active' : 'nav-item'}
                type="button"
                aria-current={tab === item.id ? 'page' : undefined}
                onClick={() => onTabChange(item.id)}
              >
                <Icon size={20} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <main id="main-content" className="app-main">
          {children}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Primary">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={tab === item.id ? 'bottom-nav-item is-active' : 'bottom-nav-item'}
              type="button"
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => onTabChange(item.id)}
            >
              <Icon size={22} strokeWidth={tab === item.id ? 2.5 : 2} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
