/**
 * Tests del componente Button.
 *
 * Cubre: render de children, click handler, variante ghost, isLoading.
 * Usa @testing-library/user-event para simular clicks reales.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renderiza los children', () => {
    render(<Button>Crear venta</Button>);
    expect(screen.getByRole('button', { name: 'Crear venta' })).toBeInTheDocument();
  });

  it('llama al onClick al hacer click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('variant="ghost" aplica clase transparente', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/bg-transparent/);
  });

  it('variant="danger" aplica clase roja', () => {
    render(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole('button').className).toMatch(/bg-red-600/);
  });

  it('isLoading deshabilita el botón', () => {
    render(<Button isLoading>Guardando</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('isLoading muestra el spinner', () => {
    const { container } = render(<Button isLoading>Guardando</Button>);
    // El Spinner es un SVG con role="status" (asumiendo Spinner de a11y)
    // Si no tiene role, al menos verificamos que hay un svg.
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('type="button" por defecto (no submit accidental)', () => {
    render(<Button>OK</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
