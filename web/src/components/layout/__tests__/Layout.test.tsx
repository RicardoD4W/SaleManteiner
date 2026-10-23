import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { renderWithProviders } from '@/test-utils/render';

function renderLayout(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route path="revenue" element={<div>Ingresos</div>} />
        <Route path="products" element={<div>Productos</div>} />
        <Route path="buyers" element={<div>Compradores</div>} />
        <Route path="buys" element={<div>Compras</div>} />
      </Route>
    </Routes>,
    { route: route },
  );
}

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
    (route) => {
      renderLayout(route);
      expect(linkDashboard().className).toMatch(/bg-brand-100/);
    },
  );

  it('el link "Dashboard" del header NO está iluminado en otras páginas', () => {
    renderLayout('/buys');
    expect(linkDashboard().className).not.toMatch(/bg-brand-100/);
  });
});
