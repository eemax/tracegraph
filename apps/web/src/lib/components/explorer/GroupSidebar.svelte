<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
  import type { ExplorerState } from '$lib/state/explorer.svelte';
  import { allGroupsKey } from '$lib/state/explorer.svelte';

  let { state }: { state: ExplorerState } = $props();
</script>

<div class="flex h-full min-h-0 flex-col" aria-label="Event groups">
  <ScrollArea class="min-h-0 flex-1">
    <div class="space-y-1 p-2">
      <Button
        class="w-full justify-between"
        variant={state.selectedGroup === allGroupsKey ? 'secondary' : 'ghost'}
        onclick={() => {
          state.selectGroup(allGroupsKey);
        }}
        title="All traces"
      >
        <span class="truncate">All traces</span>
        <strong class="text-xs tabular-nums">{state.events.length}</strong>
      </Button>

      {#each state.groups as group (group.key)}
        <Button
          class="w-full justify-between"
          variant={state.selectedGroup === group.key ? 'secondary' : 'ghost'}
          onclick={() => {
            state.selectGroup(group.key);
          }}
          title={group.key}
        >
          <span
            class={`truncate ${group.isLeaf ? '' : 'font-semibold'}`}
            style={`padding-left: ${group.depth * 0.7}rem`}
          >
            {group.label}
          </span>
          <strong class="text-xs tabular-nums">{group.count}</strong>
        </Button>
      {/each}

      {#if state.groups.length === 0}
        <p class="px-1 py-2 text-xs text-muted-foreground">No traces yet.</p>
      {/if}
    </div>
  </ScrollArea>
</div>
