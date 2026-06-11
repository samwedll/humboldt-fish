<script lang="ts">
  import type { NowVerdict } from '$lib/types.js';
  import VerdictPill from './VerdictPill.svelte';
  import { formatPacificTime } from '$lib/format.js';

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

  const STATUS_ICON: Record<string, string> = { pass: '✓', warn: '⚠', fail: '✗', unknown: '?' };
</script>

<section class="rounded border border-neutral-300 bg-neutral-50 p-3 text-sm" data-testid="now-strip">
  <div class="flex items-center gap-2">
    <span class="text-xs font-semibold uppercase tracking-wide text-neutral-500">
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
    <div class="mt-1 text-xs text-sky-700">🌊 {now.tideContext}</div>
  {/if}

  {#if now.factors.length > 0}
    <ul class="mt-1 space-y-0.5 text-xs text-neutral-600">
      {#each now.factors as f}
        <li>
          {STATUS_ICON[f.status] ?? '?'} {f.name}: {f.value}{f.note ? ` — ${f.note}` : ''}
        </li>
      {/each}
    </ul>
  {/if}

  {#if obsAgeLabel}
    <div class="mt-1 text-xs {now.staleness.degraded ? 'font-medium text-amber-700' : 'text-neutral-500'}">
      Buoy 46244 obs: {obsAgeLabel}
    </div>
  {/if}

  {#if now.verdict !== 'NO-GO' && now.checklist.length > 0}
    <div class="mt-2 border-t border-neutral-200 pt-2 text-xs">
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

  {#if now.footer}
    <div class="mt-2 text-xs italic text-neutral-500">{now.footer}</div>
  {/if}
</section>
