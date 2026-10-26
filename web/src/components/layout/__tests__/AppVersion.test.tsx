import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppVersion } from '../AppVersion';

describe('AppVersion', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('muestra la versión de la app, del front y del back', () => {
    vi.stubEnv('VITE_APP_VERSION', '1.2.3');
    vi.stubEnv('VITE_FRONT_VERSION', '0.4.5');
    vi.stubEnv('VITE_BACK_VERSION', '0.6.7');

    render(<AppVersion />);

    const footer = screen.getByText(/SaleManteiner/);
    expect(footer.textContent).toContain('1.2.3');
    expect(footer.textContent).toContain('front 0.4.5');
    expect(footer.textContent).toContain('back 0.6.7');
  });

  it('sin versiones inyectadas muestra "dev" en vez de romperse', () => {
    vi.stubEnv('VITE_APP_VERSION', undefined);
    vi.stubEnv('VITE_FRONT_VERSION', undefined);
    vi.stubEnv('VITE_BACK_VERSION', undefined);

    render(<AppVersion />);

    expect(screen.getByText(/SaleManteiner/).textContent).toContain('dev');
  });
});
