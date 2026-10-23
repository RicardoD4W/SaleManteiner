import { NavLink as RouterNavLink, type NavLinkProps } from 'react-router-dom';
import { navLinkClass } from '../ui/tableStyles';

export function NavLink({ className, ...props }: NavLinkProps) {
  return <RouterNavLink {...props} className={className ?? navLinkClass} />;
}
