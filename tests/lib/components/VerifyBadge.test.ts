import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import VerifyBadge from '../../../src/lib/components/VerifyBadge.svelte';

describe('VerifyBadge', () => {
  it('renders nothing when confidence is confirmed', () => {
    const { container } = render(VerifyBadge, { confidence: 'confirmed', sourceUrl: 'https://example.com' });
    expect(container.querySelector('a')).toBeNull();
  });
  it('renders a verify link for historical values', () => {
    render(VerifyBadge, { confidence: 'historical', sourceUrl: 'https://wildlife.ca.gov/Fishing/Inland' });
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://wildlife.ca.gov/Fishing/Inland');
    expect(link.textContent?.toLowerCase()).toContain('verify');
  });
  it('renders a verify link for unverified values', () => {
    render(VerifyBadge, { confidence: 'unverified', sourceUrl: 'https://example.com' });
    expect(screen.getByRole('link')).toBeInTheDocument();
  });
});
