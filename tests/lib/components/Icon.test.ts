import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Icon from '../../../src/lib/components/Icon.svelte';

describe('Icon', () => {
  it('renders an aria-hidden svg for a known name', () => {
    const { container } = render(Icon, { props: { name: 'check' } });
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders distinct paths for different names', () => {
    const a = render(Icon, { props: { name: 'check' } }).container.innerHTML;
    const b = render(Icon, { props: { name: 'warn' } }).container.innerHTML;
    expect(a).not.toBe(b);
  });

  it('applies a passed class', () => {
    const { container } = render(Icon, { props: { name: 'tide', class: 'text-accent' } });
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('text-accent');
  });
});
