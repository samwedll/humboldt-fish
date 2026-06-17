<script lang="ts">
  import Icon from './Icon.svelte';
  import { getStoredPref, setStoredPref, applyTheme, systemPrefersDark, resolveTheme, type Theme } from '$lib/theme.js';

  // Effective theme drives which glyph shows. Initialised from storage on mount.
  let theme = $state<Theme>('light');

  $effect(() => {
    theme = resolveTheme(getStoredPref(), systemPrefersDark());
    // Keep "follow system" live while no explicit choice is set.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getStoredPref() === 'system') theme = applyTheme('system');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setStoredPref(next);
    theme = applyTheme(next);
  }
</script>

<button
  type="button"
  onclick={toggle}
  class="rounded-full border border-white/20 p-1.5 text-on-chrome/90 hover:bg-white/10"
  aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
>
  <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
</button>
