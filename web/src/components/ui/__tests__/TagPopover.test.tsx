import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagPopover } from '../TagPopover';
import { renderWithProviders } from '@/test-utils/render';

const tag = { id: 7, name: 'Urgente', color: '#dc2626' };

describe('TagPopover', () => {
  it('does not render anything when there is no tag', () => {
    const { container } = renderWithProviders(<TagPopover tag={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render anything when the tag is undefined', () => {
    const { container } = renderWithProviders(<TagPopover tag={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an image role with the accessible name Tag: <name>', () => {
    renderWithProviders(<TagPopover tag={tag} />);

    expect(screen.getByRole('img', { name: 'Tag: Urgente' })).toBeInTheDocument();
  });

  it('paints the icon with the tag color', () => {
    renderWithProviders(<TagPopover tag={tag} />);

    const icon = screen.getByRole('img', { name: 'Tag: Urgente' });
    expect(icon).toHaveStyle({ color: '#dc2626' });
  });

  it('shows the tag name and its color on hover', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TagPopover tag={tag} />);

    await user.hover(screen.getByRole('img', { name: 'Tag: Urgente' }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Urgente');
    expect(within(tooltip).getByTestId('tag-color-swatch')).toHaveStyle({
      backgroundColor: '#dc2626',
    });
  });
});
