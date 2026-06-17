<script lang="ts">
  import type { NowVerdict } from '$lib/types.js';
  import VerdictPill from './VerdictPill.svelte';
  import { formatPacificTime } from '$lib/format.js';
  import Icon from './Icon.svelte';
  import type { IconName } from './Icon.svelte';

  type Props = { now: NowVerdict; nowMs: number };
  let { now, nowMs }: Props = $props();

  const hhmm = (ms: number) => formatPacificTime(new Date(ms));

  // "launch by" is only worth surfacing when the gate closes within 2 h —
  // beyond that it's noise next to the windows list below.
  let showLaunchBy = $derived(
    now.launchByMs !== undefined && now.launchByMs - nowMs < 2 * 3_600_000
  );

  let obsAgeLabel = $derived.by(() => {
    if (now.staleness.obsAgeMs === null) return null;
    const min = Math.round(now.staleness.obsAgeMs / 60_000);
    return min < 60 ? `${min}m ago` : `${Math.floor(min / 60)}h ${min % 60}m ago`;
  });

  const STATUS_ICON: Record<string, IconName> = { pass: 'check', warn: 'warn', fail: 'x', unknown: 'question' };
  const STATUS_CLASS: Record<string, string> = {
    pass: 'text-verdict-go', warn: 'text-verdict-conditional', fail: 'text-verdict-nogo', unknown: 'text-verdict-incomplete'
  };
</script>

<section class="rounded border border-line bg-surface2 p-3 text-sm" data-testid="now-strip">
  <div class="flex items-center gap-2">
    <span class="text-xs font-semibold uppercase tracking-wide text-muted">
      Right now ({hhmm(nowMs)})
    </span>
    <VerdictPill verdict={now.verdict} size="sm" />
  </div>

  <div class="mt-1">
    {#if now.verdict === 'NO-GO'}
      <span>{now.reason}</span>
      {#if now.nextViableAtMs !== undefined}
        <span class="font-medium">Viable from {hhmm(now.nextViableAtMs)}.</span>
      {/if}
    {:else}
      <span>
        Launch now{showLaunchBy && now.launchByMs !== undefined ? ` (by ${hhmm(now.launchByMs)})` : ''},
        return by {now.returnByMs !== undefined ? hhmm(now.returnByMs) : '—'}
      </span>
    {/if}
  </div>

  {#if now.tideContext}
    <div class="mt-1 flex items-center gap-1 text-xs text-accent"><Icon name="tide" size={13} /> {now.tideContext}</div>
  {/if}

  {#if now.factors.length > 0}
    <ul class="mt-1 space-y-0.5 text-xs text-muted">
      {#each now.factors as f}
        <li>
          <Icon name={STATUS_ICON[f.status] ?? 'question'} size={12} class={STATUS_CLASS[f.status] ?? 'text-verdict-incomplete'} /><span class="sr-only">{f.status}:</span> {f.name}: {f.value}{f.note ? ` — ${f.note}` : ''}
        </li>
      {/each}
    </ul>
  {/if}

  {#if obsAgeLabel}
    <div class="mt-1 font-mono text-xs {now.staleness.degraded ? 'font-medium text-verdict-conditional' : 'text-muted'}">
      Buoy 46244 obs: {obsAgeLabel}
    </div>
  {/if}

  {#if now.bailout}
    <div class="callout-caution mt-2 rounded p-2 text-xs">
      <strong>Bailout:</strong> {now.bailout}
    </div>
  {/if}

  {#if now.verdict !== 'NO-GO' && now.checklist.length > 0}
    <div class="mt-2 border-t border-line pt-2 text-xs">
      <span class="font-semibold">Before leaving:</span>
      <ul class="ml-4 mt-1 list-disc">
        {#each now.checklist as item}
          <li>
            {item.label}{#if item.phone}
              — <a class="underline" href={`tel:${item.phone.replace(/-/g, '')}`}>{item.phone}</a>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if now.verdict !== 'NO-GO' && now.footer}
    <div class="mt-2 text-xs italic text-muted">{now.footer}</div>
  {/if}
</section>
