import { NavLink as RouterNavLink, type NavLinkProps } from 'react-router-dom';

export const cn = ({ isActive }: { isActive: boolean }): string =>
  [
    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
    isActive
      ? 'bg-brand-100 text-brand-800'
      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
  ].join(' ');

export function NavLink(props: NavLinkProps) {
  return <RouterNavLink {...props} className={cn} />;
}
