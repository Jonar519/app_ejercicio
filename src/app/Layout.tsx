import { Dumbbell, Salad, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/entrenamiento', label: 'Entrenamiento', icon: Dumbbell },
  { to: '/nutricion', label: 'Nutrición', icon: Salad },
  { to: '/perfil', label: 'Perfil', icon: UserRound },
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-14 flex-1 flex-col items-center justify-center text-sm ${
    isActive
      ? 'font-semibold text-emerald-800 dark:text-emerald-300'
      : 'text-neutral-700 dark:text-neutral-300'
  }`;

export function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex flex-1 flex-col gap-6 p-4 pb-24">
        <Outlet />
      </main>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 border-t border-neutral-300 bg-white pb-[env(safe-area-inset-bottom)] dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="mx-auto flex max-w-md">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={tabClass}>
              <Icon aria-hidden="true" size={22} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
