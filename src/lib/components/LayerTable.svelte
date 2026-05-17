<script lang="ts">
  import type { Verdict, LayerName, LayerStatus, Check } from '$lib/types.js';

  type Props = { verdict: Verdict };
  let { verdict }: Props = $props();

  const rows: { name: LayerName; label: string }[] = [
    { name: 'legal', label: 'Legal' },
    { name: 'safety', label: 'Safety' },
    { name: 'quality', label: 'Quality' },
    { name: 'logistics', label: 'Logistics' }
  ];

  const icon: Record<LayerStatus, string> = {
    pass: '✓', warn: '⚠', fail: '✗', incomplete: '?'
  };
  const iconClass: Record<LayerStatus, string> = {
    pass: 'text-green-600',
    warn: 'text-yellow-600',
    fail: 'text-red-600',
    incomplete: 'text-neutral-500'
  };

  function checksForLayer(name: LayerName): Check[] {
    return verdict.checks.filter((c) => c.layer === name);
  }

  let expanded = $state<Record<LayerName, boolean>>({
    legal: false, safety: false, quality: false, logistics: false
  });

  function toggle(name: LayerName) {
    expanded[name] = !expanded[name];
  }

  function checkIconClass(status: Check['status']): string {
    return iconClass[status === 'unknown' ? 'incomplete' : status];
  }
  function checkIcon(status: Check['status']): string {
    return icon[status === 'unknown' ? 'incomplete' : status];
  }
</script>

<table class="w-full border-collapse text-sm">
  <tbody>
    {#each rows as row}
      {@const status = verdict.layers[row.name].status}
      {@const summary = verdict.layers[row.name].summary}
      <tr class="border-b border-neutral-200 last:border-0">
        <td class="py-3 pr-2 align-top w-10">
          <span class={`text-2xl ${iconClass[status]}`}>{icon[status]}</span>
        </td>
        <td class="py-3 pr-3 align-top font-semibold w-24">{row.label}</td>
        <td class="py-3 align-top">
          <div>{summary}</div>
          {#if checksForLayer(row.name).length > 0}
            <button
              type="button"
              class="mt-1 text-xs underline text-neutral-600"
              onclick={() => toggle(row.name)}
            >
              {expanded[row.name] ? 'Hide' : 'Show'} {checksForLayer(row.name).length} check{checksForLayer(row.name).length === 1 ? '' : 's'}
            </button>
            {#if expanded[row.name]}
              <ul class="mt-2 space-y-1 text-xs text-neutral-700">
                {#each checksForLayer(row.name) as c}
                  <li>
                    <span class={checkIconClass(c.status)}>{checkIcon(c.status)}</span>
                    <strong>{c.name}:</strong> {c.value} ({c.threshold})
                    {#if c.note}<div class="ml-4 italic text-neutral-500">{c.note}</div>{/if}
                  </li>
                {/each}
              </ul>
            {/if}
          {/if}
        </td>
      </tr>
    {/each}
  </tbody>
</table>
