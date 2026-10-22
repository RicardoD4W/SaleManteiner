import { NavLink as RouterNavLink, type NavLinkProps } from 'react-router-dom';

export const cn = ({ isActive }: { isActive: boolean }): string =>
  [
    // `shrink-0`: los links del nav no se encogen (el nav scrollea en
    // pantallas angostas en vez de deformar el texto).
    'shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
    isActive
      ? 'bg-brand-100 text-brand-800 dark:bg-brand-400/40 dark:text-brand-100'
      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100',
  ].join(' ');

export function NavLink({ className, ...props }: NavLinkProps) {
  // `className` propio gana: algunos links necesitan decidir el
  // resaltado por su cuenta (ej. el link "Dashboard" del header, que
  // también se queda iluminado cuando estás en una sub-tab).
  return <RouterNavLink {...props} className={className ?? cn} />;
}
