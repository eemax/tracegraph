<script lang="ts">
  import { Badge } from '$lib/components/ui/badge/index.js';
  import type { ExplorerState } from '$lib/state/explorer.svelte';

  let { state }: { state: ExplorerState } = $props();

  function liveVariant(value: ExplorerState['connectionState']): 'default' | 'secondary' | 'destructive' {
    if (value === 'live') {
      return 'default';
    }

    if (value === 'disconnected') {
      return 'destructive';
    }

    return 'secondary';
  }
</script>

<header class="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border bg-card px-3 py-2 shadow-xs">
  <h1 class="text-base font-semibold tracking-wide">Tracegraph</h1>

  <div class="flex flex-wrap items-center gap-0.5" aria-live="polite">
    <Badge variant="outline">Total {state.total}</Badge>
    <Badge variant="outline">Dropped {state.dropped}</Badge>
    <Badge variant="outline">Loaded {state.events.length}</Badge>
    <Badge variant={liveVariant(state.connectionState)}>{state.liveLabel}</Badge>
  </div>
</header>
