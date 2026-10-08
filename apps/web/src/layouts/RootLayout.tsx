import { Suspense } from 'react';
import { Outlet } from 'react-router';

export function RootLayout() {
  return (
    <div className="min-h-dvh bg-background font-sans text-foreground antialiased">
      <Suspense
        fallback={<p className="px-5 py-8 text-sm text-muted">Carregando página</p>}
      >
        <Outlet />
      </Suspense>
    </div>
  );
}
