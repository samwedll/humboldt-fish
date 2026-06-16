<script lang="ts" module>
  // 24x24 viewBox, stroke uses currentColor. Inner markup per icon name.
  export type IconName =
    | 'check' | 'x' | 'warn' | 'question' | 'tide' | 'copy'
    | 'block' | 'refresh' | 'sun' | 'moon' | 'info' | 'external';

  const PATHS: Record<IconName, string> = {
    check: '<path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    x: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    warn: '<path d="M12 3.5l8.5 15H3.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1.1" fill="currentColor"/>',
    question: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.4 9.2a2.7 2.7 0 1 1 3.6 2.6c-.9.5-1 .9-1 1.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16.6" r="1.1" fill="currentColor"/>',
    tide: '<path d="M2 9c2-2.4 4.3-2.4 6.3 0s4.3 2.4 6.3 0 4.3-2.4 6.3 0M2 15c2-2.4 4.3-2.4 6.3 0s4.3 2.4 6.3 0 4.3-2.4 6.3 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    copy: '<rect x="5.5" y="4.5" width="13" height="16" rx="2.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 4.5h6v2.2H9z" fill="currentColor"/>',
    block: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.5 12h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.2 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 5v6h-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    sun: '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    moon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.6" r="1.1" fill="currentColor"/>',
    external: '<path d="M14 5h5v5M19 5l-8 8M11 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  };

  export function iconMarkup(name: IconName): string {
    return PATHS[name];
  }
</script>

<script lang="ts">
  type Props = { name: IconName; size?: number | string; class?: string };
  let { name, size = '1em', class: klass = '' }: Props = $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  class={klass}
  aria-hidden="true"
  focusable="false"
>{@html iconMarkup(name)}</svg>
