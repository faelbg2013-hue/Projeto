import { NavLink } from 'react-router';

const items = [
  { to: '/cliente', label: 'Início' },
  { to: '/agendar', label: 'Agendar' },
  { to: '/agendamentos', label: 'Meus agendamentos' },
  { to: '/pontos', label: 'Meus pontos' },
  { to: '/conta', label: 'Minha conta' },
] as const;

export function ClientNavigation() {
  return (
    <nav
      aria-label="Área do cliente"
      className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-[0.68rem] uppercase tracking-[0.28em]"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end
          className={({ isActive }) =>
            [
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground',
              isActive
                ? 'text-foreground underline decoration-foreground decoration-2 underline-offset-4'
                : 'text-muted no-underline',
            ].join(' ')
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
