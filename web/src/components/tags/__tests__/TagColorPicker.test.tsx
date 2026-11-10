import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagColorPicker } from '@/components/tags/TagColorPicker';
import { renderWithProviders } from '@/test-utils/render';
import { TAG_PALETTE } from '@/lib/tagColors';

function renderPicker(value = '#dc2626') {
  const onChange = vi.fn();
  renderWithProviders(<TagColorPicker value={value} onChange={onChange} />);
  return { onChange };
}

describe('TagColorPicker', () => {
  it('muestra un swatch por cada color de la paleta y marca el elegido', () => {
    renderPicker();

    const swatches = screen.getAllByRole('button', { name: /^Color #/ });
    expect(swatches).toHaveLength(TAG_PALETTE.length);
    expect(screen.getByRole('button', { name: 'Color #dc2626' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Color #16a34a' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('al pulsar un swatch avisa del color', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker();

    await user.click(screen.getByRole('button', { name: 'Color #16a34a' }));

    expect(onChange).toHaveBeenCalledWith('#16a34a');
  });

  it('al escribir un hex válido avisa del color', () => {
    const { onChange } = renderPicker();

    fireEvent.change(screen.getByLabelText('Color libre'), { target: { value: '#123456' } });

    expect(onChange).toHaveBeenCalledWith('#123456');
  });

  it('al escribir un hex inválido avisa del error y no llama al padre', () => {
    const { onChange } = renderPicker();

    fireEvent.change(screen.getByLabelText('Color libre'), { target: { value: 'rojo' } });

    expect(screen.getByRole('alert')).toHaveTextContent('El color debe tener formato #rrggbb');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('el selector nativo de color avisa del color elegido', () => {
    const { onChange } = renderPicker();

    fireEvent.change(screen.getByLabelText('Selector de color'), {
      target: { value: '#ff8800' },
    });

    expect(onChange).toHaveBeenCalledWith('#ff8800');
  });
});
