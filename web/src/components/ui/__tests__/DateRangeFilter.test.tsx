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

  it('"Quitar filtro" aparece siempre y borra el filtro', async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilter({ value: { from: '2026-04-10', to: '2026-04-30' } });

    const quitar = screen.getByRole('button', { name: 'Quitar filtro' });
    await user.click(quitar);

    expect(onChange).toHaveBeenCalledWith({});
  });

  it('sin filtro el botón "Quitar filtro" sigue visible y no hace nada', async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilter();

    const quitar = screen.getByRole('button', { name: 'Quitar filtro' });
    await user.click(quitar);

    expect(quitar).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('los presets quedan a la izquierda y las fechas y "Quitar filtro" a la derecha', () => {
    renderFilter({ value: { from: '2026-04-10', to: '2026-04-30' } });

    const presetsGroup = screen.getByRole('button', { name: 'Todo' }).parentElement!;
    const row = presetsGroup.parentElement!;
    const datesGroup = screen.getByLabelText('Desde').parentElement!.parentElement!;
    const quitar = screen.getByRole('button', { name: 'Quitar filtro' });

    expect(row).toHaveClass('justify-between');
    expect(row.firstElementChild).toBe(presetsGroup);
    expect(datesGroup.parentElement).toBe(row);
    expect(datesGroup.contains(quitar)).toBe(true);
  });

  it('con layout "stacked" los presets quedan encima de los campos de fecha', () => {
    renderFilter({ layout: 'stacked', value: { from: '2026-04-10', to: '2026-04-30' } });

    const presetsGroup = screen.getByRole('button', { name: 'Todo' }).parentElement!;
    const datesGroup = screen.getByLabelText('Desde').parentElement!.parentElement!;

    expect(presetsGroup.parentElement).toBe(datesGroup.parentElement);
    expect(presetsGroup.parentElement!.firstElementChild).toBe(presetsGroup);
  });

  it('con layout "stacked" sigue mostrando las etiquetas y el botón de limpiar', () => {
    renderFilter({ layout: 'stacked' });

    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    expect(screen.getByLabelText('Hasta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar filtro' })).toBeInTheDocument();
  });

  it('la descripción del rango queda justo a la derecha de "Este año"', () => {
    renderFilter();

    const presetsGroup = screen.getByRole('button', { name: 'Todo' }).parentElement!;
    const ultimoPreset = screen.getByRole('button', { name: 'Este año' });
    const descripcion = screen.getByText('Sin filtro de fecha');

    expect(presetsGroup.contains(descripcion)).toBe(true);
    expect(descripcion.previousElementSibling).toBe(ultimoPreset);
  });

  it('el rango aplicado se describe en pantalla', () => {
    renderFilter({ value: { from: '2026-04-10', to: '2026-04-30' } });

    expect(screen.getByText('Del 10/04/2026 al 30/04/2026')).toBeInTheDocument();
  });
});
