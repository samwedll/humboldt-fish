import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import RegRow from '../../../src/lib/components/RegRow.svelte';

describe('RegRow', () => {
  it('renders label and value', () => {
    render(RegRow, { label: 'SIZE', value: '≥ 22″ total length' });
    expect(screen.getByText('SIZE')).toBeInTheDocument();
    expect(screen.getByText(/22″ total length/)).toBeInTheDocument();
  });
  it('renders a verify badge when confidence is non-confirmed', () => {
    render(RegRow, { label: 'SIZE', value: '≥ 14″', confidence: 'historical', sourceUrl: 'https://example.com' });
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.com');
  });
  it('omits the badge when confirmed', () => {
    const { container } = render(RegRow, { label: 'BAG', value: '3 / day', confidence: 'confirmed', sourceUrl: 'https://example.com' });
    expect(container.querySelector('a')).toBeNull();
  });
});
