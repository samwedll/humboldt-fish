<script lang="ts">
  import type { Confidence } from '$lib/config/regs.js';
  import Icon from './Icon.svelte';
  type Props = { confidence: Confidence; sourceUrl: string };
  let { confidence, sourceUrl }: Props = $props();
</script>

{#if confidence !== 'confirmed'}
  <a
    href={sourceUrl}
    target="_blank"
    rel="noopener noreferrer"
    class="callout-caution ml-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 align-middle text-[10px] font-medium"
  >
    <Icon name="warn" size={11} /> Verify{confidence === 'historical' ? ' (historical)' : ''} <Icon name="external" size={10} />
  </a>
{/if}
