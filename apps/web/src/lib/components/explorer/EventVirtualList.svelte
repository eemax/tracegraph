<script lang="ts">
  import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import type { ExplorerState } from '$lib/state/explorer.svelte';
  import { formatDurationMs, formatTimestamp } from '$lib/ui';

  let { state }: { state: ExplorerState } = $props();

  function registerListPane(node: HTMLDivElement): { destroy: () => void } {
    state.setListPane(node);

    return {
      destroy: () => {
        state.setListPane(null);
      }
    };
  }
</script>

<div class="flex min-h-0 flex-1 flex-col">
  {#if state.selectedGroupSummary}
    <div class="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs">
      <Badge variant="secondary">trace...{state.selectedGroupSummary.traceId.slice(-8)}</Badge>
      <span class="text-muted-foreground">{state.selectedGroupSummary.eventCount} events</span>
      <span class="text-muted-foreground">{formatDurationMs(state.selectedGroupSummary.durationMs)}</span>
    </div>
  {/if}

  {#if !state.loading && state.events.length === 0}
    <div class="p-3">
      <Alert>
        <AlertTitle>No events yet</AlertTitle>
        <AlertDescription>Waiting for events from configured sources.</AlertDescription>
      </Alert>
    </div>
  {:else}
    <div
      class="min-h-0 flex-1 overflow-auto p-2"
      use:registerListPane
      onscroll={state.onListScroll}
      data-testid="event-list"
      role="listbox"
      aria-label="Events"
      aria-activedescendant={state.selectedId ? `event-option-${state.selectedId}` : undefined}
      tabindex="0"
    >
      <div style={`height: ${state.topPadding}px;`} aria-hidden="true"></div>

      {#if state.loading && state.events.length === 0}
        <div class="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
          <Spinner class="size-4" />
          Loading events...
        </div>
      {:else}
        {#each state.visibleRows as row (row.id)}
          <div
            id={`event-option-${row.id}`}
            class={`event-row mb-1 flex h-[50px] w-full items-start justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors ${
              state.selectedId === row.id
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-background hover:border-primary/40 hover:bg-accent/40'
            }`}
            onclick={() => {
              state.selectEvent(row.id);
            }}
            onkeydown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                state.selectEvent(row.id);
              }
            }}
            title={`${row.sourceLabel} • ${row.event}`}
            data-testid="event-row"
            role="option"
            aria-selected={state.selectedId === row.id}
            tabindex={state.selectedId === row.id ? 0 : -1}
          >
            <div class="min-w-0">
              <strong class="block truncate text-sm font-medium">{row.event}</strong>
              <span class="inline-flex max-w-full items-center gap-2 truncate text-muted-foreground">
                <span>{row.stage ?? 'n/a'}</span>
                <span>{row.sourceLabel}</span>
              </span>
            </div>
            <span class="shrink-0 text-muted-foreground">{formatTimestamp(row.timestamp)}</span>
          </div>
        {/each}
      {/if}

      <div style={`height: ${state.bottomPadding}px;`} aria-hidden="true"></div>
    </div>
  {/if}

  {#if state.loadingMore}
    <div class="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
      <Spinner class="size-3" />
      Loading more...
    </div>
  {/if}
</div>
