<script lang="ts">
  import { Badge } from '$lib/components/ui/badge/index.js';
  import type { ExplorerState } from '$lib/state/explorer.svelte';

  let { state }: { state: ExplorerState } = $props();
</script>

<section class="flex flex-wrap items-center gap-1 border-b px-3 py-2" aria-label="Source status">
  {#if state.sourceList.length === 0}
    <span class="text-xs text-muted-foreground">Waiting for source status...</span>
  {:else}
    {#each state.sourceList as sourceStatus}
      <div class="inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs">
        <strong class="font-medium">{sourceStatus.sourceId}</strong>
        <Badge variant={sourceStatus.healthy ? 'default' : 'destructive'}>
          {sourceStatus.healthy ? 'healthy' : 'degraded'}
        </Badge>
        <span class="text-muted-foreground">lines {sourceStatus.totalLines}</span>
        <span class="text-muted-foreground">malformed {sourceStatus.malformedLines}</span>
      </div>
    {/each}
  {/if}
</section>
