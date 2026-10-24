import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Input } from '../Input';
import { renderWithProviders } from '../../../test-utils/render';

describe('Input', () => {
  it('el ref llega al nodo del input', () => {
    const ref = createRef<HTMLInputElement>();

    renderWithProviders(<Input label="Nombre *" ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toBe(screen.getByLabelText('Nombre *'));
  });

  it('el ref también acepta un callback', () => {
    let node: HTMLInputElement | null = null;

    renderWithProviders(
      <Input
        label="Nombre *"
        ref={(element) => {
          node = element;
        }}
      />,
    );

    expect(node).toBe(screen.getByLabelText('Nombre *'));
  });
});
