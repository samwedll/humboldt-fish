import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import VerdictPanel from '../../../src/lib/components/VerdictPanel.svelte';

describe('VerdictPanel', () => {
  it('renders the verdict word and reason', () => {
    const { getByText } = render(VerdictPanel, {
      props: { verdict: 'NO-GO', reason: 'Swell 6.2 ft over your 5 ft limit.' }
    });
    expect(getByText('NO-GO')).toBeTruthy();
    expect(getByText('Swell 6.2 ft over your 5 ft limit.')).toBeTruthy();
  });

  it('exposes the verdict via data attribute', () => {
    const { container } = render(VerdictPanel, { props: { verdict: 'GO', reason: 'clear' } });
    expect(container.querySelector('[data-verdict="GO"]')).toBeTruthy();
  });
});
