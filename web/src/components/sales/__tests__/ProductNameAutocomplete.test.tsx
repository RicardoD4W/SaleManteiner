import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useProductNames', () => ({
  useProductNames: vi.fn(),
}));

import { useProductNames } from '@/hooks/useProductNames';
import { ProductNameAutocomplete } from '@/components/sales/ProductNameAutocomplete';
import { renderWithProviders } from '@/test-utils/render';

const mockProducts = [
  { name: 'iPhone 12', uses: 3 },
  { name: 'Funda iPhone 15', uses: 1 },
  { name: 'Cámara réflex', uses: 2 },
];

function Harness({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <ProductNameAutocomplete
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

function EditableHarness() {
  const [value, setValue] = useState('');
  return (
    <>
      <ProductNameAutocomplete value={value} onChange={setValue} />
      <button type="button" onClick={() => setValue('cámara')}>
        Cambiar valor
      </button>
    </>
  );
}

describe('ProductNameAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useProductNames).mockReturnValue({
      data: mockProducts as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
  });

  it('renderiza el label y el input como combobox', () => {
    renderWithProviders(<Harness />);

    expect(screen.getByText('Producto *')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('al tipear muestra las sugerencias que coinciden, ignorando mayúsculas y acentos', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(screen.getByRole('combobox'), 'IPHONE');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /iPhone 12/ })).toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: /Funda iPhone 15/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Cámara réflex/ })).not.toBeInTheDocument();
  });

  it('la lista de sugerencias entra con una animación de entrada', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(screen.getByRole('combobox'), 'IPHONE');

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    expect(screen.getByRole('listbox')).toHaveClass('animate-pop-in');
  });

  it('la lista de sugerencias sale con una animación de salida y luego desaparece', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(screen.getByRole('combobox'), 'iphone');
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const listbox = screen.getByRole('listbox');
    await user.keyboard('{Escape}');

    expect(listbox).toHaveClass('animate-pop-out');
    expect(listbox).not.toHaveClass('animate-pop-in');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('la lista congelada no cambia de contenido mientras se desvanece', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EditableHarness />);

    const input = screen.getByRole('combobox');
    await user.type(input, 'iphone');
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    fireEvent.blur(input);

    expect(screen.getByRole('listbox')).toHaveClass('animate-pop-out');

    await user.click(screen.getByRole('button', { name: 'Cambiar valor' }));

    expect(screen.getByRole('listbox')).toHaveClass('animate-pop-out');
    expect(screen.getByText('iPhone 12')).toBeInTheDocument();
    expect(screen.queryByText('Cámara réflex')).toBeNull();
  });

  it('al hacer click en una sugerencia pone ese nombre en el campo', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);

    await user.type(screen.getByRole('combobox'), 'camara');
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Cámara réflex/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('option', { name: /Cámara réflex/ }));

    expect(onChange).toHaveBeenCalledWith('Cámara réflex');
    expect(screen.getByRole('combobox')).toHaveValue('Cámara réflex');
  });

  it('el teclado recorre las sugerencias y Enter elige la activa', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);

    const input = screen.getByRole('combobox');
    await user.type(input, 'i');
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('Funda iPhone 15');
  });

  it('Escape cierra la lista sin cambiar el valor', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);

    await user.type(screen.getByRole('combobox'), 'iphone');
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
    expect(onChange).toHaveBeenCalledWith('iphone');
  });

  it('sin coincidencias avisa de que el nombre se guarda tal cual', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.type(screen.getByRole('combobox'), 'zzz');

    await waitFor(() => {
      expect(screen.getByText(/se guardará tal cual/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('la lista se cierra al perder el foco', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'iphone');
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });
});
