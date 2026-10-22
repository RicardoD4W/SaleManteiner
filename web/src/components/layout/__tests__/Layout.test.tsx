/**
 * Tests del Layout (header + nav).
 *
 * Cubre el resaltado del link "Dashboard" del header: tiene que seguir
 * iluminado cuando estás en una de las tabs del dashboard (Ingresos,
 * Productos, Compradores), no solo en la raíz `/`.
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { renderWithProviders } from '@/test-utils/render';

/** Monta el Layout en la ruta indicada. */
function renderLayout(ruta: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route path="revenue" element={<div>Ingresos</div>} />
        <Route path="products" element={<div>Productos</div>} />
        <Route path="buyers" element={<div>Compradores</div>} />
        <Route path="buys" element={<div>Compras</div>} />
      </Route>
    </Routes>,
    { route: ruta },
  );
}

/** El link "Dashboard" del header. */
function linkDashboard(): HTMLElement {
  return screen.getByRole('link', { name: 'Dashboard' });
}

describe('Layout', () => {
  it('el link "Dashboard" del header está iluminado en la raíz', () => {
    renderLayout('/');
    expect(linkDashboard().className).toMatch(/bg-brand-100/);
  });

  it.each(['/revenue', '/products', '/buyers'])(
    'el link "Dashboard" del header sigue iluminado en la tab %s',
    (ruta) => {
      renderLayout(ruta);
      expect(linkDashboard().className).toMatch(/bg-brand-100/);
    },
  );

  it('el link "Dashboard" del header NO está iluminado en otras páginas', () => {
    renderLayout('/buys');
    expect(linkDashboard().className).not.toMatch(/bg-brand-100/);
  });
});
