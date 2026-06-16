<script lang="ts">
  import type { Confidence } from '$lib/config/regs.js';
  import VerifyBadge from './VerifyBadge.svelte';
  type Props = {
    label: string;
    value: string;
    confidence?: Confidence;
    sourceUrl?: string;
    note?: string;
  };
  let { label, value, confidence, sourceUrl, note }: Props = $props();
</script>

<div class="flex items-baseline justify-between gap-3 py-1">
  <span class="shrink-0 text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
  <span class="text-right text-sm text-neutral-900">
    {value}
    {#if note}<span class="text-neutral-500"> · {note}</span>{/if}
    {#if confidence && sourceUrl}
      <VerifyBadge {confidence} {sourceUrl} />
    {/if}
  </span>
</div>
