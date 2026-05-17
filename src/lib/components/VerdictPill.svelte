<script lang="ts">
  import type { VerdictLabel } from '$lib/types.js';

  type Props = { verdict: VerdictLabel; size?: 'sm' | 'lg' };
  let { verdict, size = 'lg' }: Props = $props();

  const classes: Record<VerdictLabel, string> = {
    'GO': 'bg-verdict-go text-white',
    'CONDITIONAL': 'bg-verdict-conditional text-white',
    'NO-GO': 'bg-verdict-nogo text-white',
    'INCOMPLETE': 'bg-verdict-incomplete text-white'
  };
</script>

<span
  data-verdict={verdict}
  class={`inline-block rounded-full font-bold uppercase tracking-wide ${classes[verdict]} ${size === 'lg' ? 'px-6 py-2 text-2xl' : 'px-3 py-1 text-xs'}`}
>
  {verdict}
</span>
