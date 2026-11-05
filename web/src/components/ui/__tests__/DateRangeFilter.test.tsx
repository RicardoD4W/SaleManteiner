import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangeFilter } from '../DateRangeFilter';
import { renderWithProviders } from '../../../test-utils/render';

const hoy = new Date(2026, 10, 5);

function renderFilter(props: Partial<React.ComponentProps<typeof DateRangeFilter>> = {}) {
  const onChange = vi.fn();
  renderWithProviders(<DateRangeFilter value={{}} onChange={onChange} today={hoy} {...props} />);
  return { onChange };
}

describe('DateRangeFilter', () => {
  it('muestra los presets y ninguno está activo al principio', () => {
    renderFilter();

    expect(screen.getByRole('button', { name: 'Todo' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Este mes' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Último trimestre' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Este año' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('al elegir "Este mes" avisa del rango del mes en curso', async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilter();

    await user.click(screen.getByRole('button', { name: 'Este mes' }));

    expect(onChange).toHaveBeenCalledWith({ from: '2026-11-01', to: '2026-11-30' });
  });

  it('al elegir "Último trimestre" avisa de los tres meses que incluyen el actual', async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilter();

    await user.click(screen.getByRole('button', { name: 'Último trimestre' }));

    expect(onChange).toHaveBeenCalledWith({ from: '2026-09-01', to: '2026-11-30' });
  });

  it('el preset aplicado queda marcado', () => {
    renderFilter({ value: { from: '2026-11-01', to: '2026-11-30' } });

    expect(screen.getByRole('button', { name: 'Este mes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Todo' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('los campos de fecha tienen etiqueta y se avisa del rango elegido', async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilter();

    const desde = screen.getByLabelText('Desde');
    const hasta = screen.getByLabelText('Hasta');
    expect(desde).toHaveAttribute('type', 'date');
    expect(hasta).toHaveAttribute('type', 'date');

    await user.type(desde, '2026-04-10');

    expect(onChange).toHaveBeenCalledWith({ from: '2026-04-10' });
  });

  it('un rango con las fechas invertidas no se aplica y se avisa', async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilter({ value: { from: '2026-04-10' } });

    await user.type(screen.getByLabelText('Hasta'), '2026-01-01');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La fecha inicial no puede ser posterior a la final',
    );
  });

  it('"Quitar filtro" aparece con un filtro activo y lo borra', async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilter({ value: { from: '2026-04-10', to: '2026-04-30' } });

    const quitar = screen.getByRole('button', { name: 'Quitar filtro' });
    await user.click(quitar);

    expect(onChange).toHaveBeenCalledWith({});
  });

  it('sin filtro no hay nada que quitar', () => {
    renderFilter();

    expect(screen.queryByRole('button', { name: 'Quitar filtro' })).toBeNull();
  });

  it('el rango aplicado se describe en pantalla', () => {
    renderFilter({ value: { from: '2026-04-10', to: '2026-04-30' } });

    expect(screen.getByText('Del 10/04/2026 al 30/04/2026')).toBeInTheDocument();
  });
});
