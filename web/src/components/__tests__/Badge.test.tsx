import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

describe('Badge', () => {
  it('renderiza los children', () => {
    render(<Badge>Hola</Badge>);
    expect(screen.getByText('Hola')).toBeInTheDocument();
  });

  it('sin variant usa estilo neutral (gris)', () => {
    render(<Badge>Neutral</Badge>);
    const span = screen.getByText('Neutral');
    expect(span.className).toMatch(/bg-gray-100/);
  });

  it('variant="success" aplica clase verde', () => {
    render(<Badge variant="success">Sí</Badge>);
    expect(screen.getByText('Sí').className).toMatch(/bg-green-100/);
  });

  it('variant="danger" aplica clase roja', () => {
    render(<Badge variant="danger">No</Badge>);
    expect(screen.getByText('No').className).toMatch(/bg-red-100/);
  });

  it('variant="warning" aplica clase amarilla', () => {
    render(<Badge variant="warning">!</Badge>);
    expect(screen.getByText('!').className).toMatch(/bg-yellow-100/);
  });

  it('variant="brand" aplica clase brand', () => {
    render(<Badge variant="brand">Tag</Badge>);
    expect(screen.getByText('Tag').className).toMatch(/bg-brand-100/);
  });

  it('es un inline-flex rounded-full', () => {
    render(<Badge>X</Badge>);
    const span = screen.getByText('X');
    expect(span.className).toMatch(/inline-flex/);
    expect(span.className).toMatch(/rounded-full/);
  });
});
