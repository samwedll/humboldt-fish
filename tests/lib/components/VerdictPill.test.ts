import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import VerdictPill from '../../../src/lib/components/VerdictPill.svelte';

describe('VerdictPill', () => {
  it('renders GO label', () => {
    const { getByText, container } = render(VerdictPill, { props: { verdict: 'GO' } });
    expect(getByText('GO')).toBeTruthy();
    expect(container.querySelector('[data-verdict="GO"]')).toBeTruthy();
  });

  it('renders CONDITIONAL', () => {
    const { getByText } = render(VerdictPill, { props: { verdict: 'CONDITIONAL' } });
    expect(getByText('CONDITIONAL')).toBeTruthy();
  });

  it('renders NO-GO', () => {
    const { getByText } = render(VerdictPill, { props: { verdict: 'NO-GO' } });
    expect(getByText('NO-GO')).toBeTruthy();
  });
});
