<script lang="ts">
  import type { Confidence } from '$lib/config/regs.js';
  type Props = { confidence: Confidence; sourceUrl: string };
  let { confidence, sourceUrl }: Props = $props();
</script>

{#if confidence !== 'confirmed'}
  <a
    href={sourceUrl}
    target="_blank"
    rel="noopener noreferrer"
    class="ml-1 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-medium text-amber-800"
  >
    ⚠ Verify{confidence === 'historical' ? ' (historical)' : ''} ↗
  </a>
{/if}
