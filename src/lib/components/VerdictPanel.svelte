<script lang="ts">
  import type { VerdictLabel } from '$lib/types.js';

  type Props = { verdict: VerdictLabel; reason: string };
  let { verdict, reason }: Props = $props();

  const VAR: Record<VerdictLabel, string> = {
    'GO': 'var(--v-go)',
    'CONDITIONAL': 'var(--v-cond)',
    'NO-GO': 'var(--v-nogo)',
    'INCOMPLETE': 'var(--v-inc)'
  };
</script>

<div
  role="status"
  data-verdict={verdict}
  class="verdict-panel"
  style={`--vc:${VAR[verdict]}`}
>
  <span class="word">{verdict}</span>
  <span class="reason">{reason}</span>
</div>

<style>
  .verdict-panel {
    border-radius: 10px;
    padding: 14px 16px;
    background: color-mix(in srgb, var(--vc) 12%, var(--surface));
    box-shadow: inset 4px 0 0 var(--vc), 0 0 0 1px color-mix(in srgb, var(--vc) 30%, var(--line));
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .word {
    font-weight: 900;
    font-size: clamp(24px, 7vw, 30px);
    line-height: 1;
    letter-spacing: 0.01em;
    color: var(--vc);
  }
  /* Dawn glow — applies for both forced-dark and system-dark (matches app.css token cascade). */
  :global([data-theme='dark']) .word {
    text-shadow: 0 0 22px color-mix(in srgb, var(--vc) 55%, transparent);
  }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme='light'])) .word {
      text-shadow: 0 0 22px color-mix(in srgb, var(--vc) 55%, transparent);
    }
  }
  .reason { font-size: 13px; color: var(--muted); }
</style>
