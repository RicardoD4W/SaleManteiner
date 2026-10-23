import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../ThemeToggle';

describe('<ThemeToggle />', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('muestra aria-label "Cambiar a tema claro" cuando el tema es dark (ícono Sun)', () => {
    document.documentElement.classList.add('dark');
    render(<ThemeToggle />);
    const btn = screen.getByTestId('theme-toggle');
    expect(btn).toHaveAttribute('aria-label', 'Cambiar a tema claro');
  });

  it('muestra aria-label "Cambiar a tema oscuro" cuando el tema es light (ícono Moon)', () => {
    document.documentElement.classList.remove('dark');
    render(<ThemeToggle />);
    const btn = screen.getByTestId('theme-toggle');
    expect(btn).toHaveAttribute('aria-label', 'Cambiar a tema oscuro');
  });

  it('al hacer click cambia el tema, la clase del <html> y persiste en localStorage', async () => {
    document.documentElement.classList.add('dark');
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const btn = screen.getByTestId('theme-toggle');
    expect(btn).toHaveAttribute('aria-label', 'Cambiar a tema claro');

    await user.click(btn);

    expect(btn).toHaveAttribute('aria-label', 'Cambiar a tema oscuro');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('salemanteiner-theme')).toBe('light');
  });

  it('los íconos SVG son decorativos (aria-hidden="true")', () => {
    document.documentElement.classList.add('dark');
    const { container } = render(<ThemeToggle />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
