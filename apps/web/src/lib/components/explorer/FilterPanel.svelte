<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import type { ExplorerState } from '$lib/state/explorer.svelte';

  let { state }: { state: ExplorerState } = $props();

  function onTextInput(key: 'q', event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    state.setFilter(key, target.value);
  }

  function toggleEventType(value: string, checked: boolean): void {
    const next = new Set(state.draftFilters.eventTypes);
    if (checked) {
      next.add(value);
    } else {
      next.delete(value);
    }
    state.setFilter(
      'eventTypes',
      [...next].sort((a, b) => a.localeCompare(b))
    );
  }
</script>

<form
  class="grid grid-cols-1 gap-2 border-y px-3 py-2 sm:grid-cols-2"
  onsubmit={(event) => {
    event.preventDefault();
    void state.applyFilters();
  }}
  data-testid="filter-form"
>
  <Label class="grid gap-1 text-xs">
    Event types
    <details class="relative" data-testid="filter-event-types">
      <summary class="bg-background border-input focus-visible:ring-ring/50 rounded-md border px-2 py-1.5 text-sm outline-none focus-visible:ring-[3px]">
        {#if state.draftFilters.eventTypes.length === 0}
          All event types
        {:else}
          {state.draftFilters.eventTypes.length} selected
        {/if}
      </summary>

      <div class="bg-popover text-popover-foreground absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border p-2 shadow-md">
        {#if state.availableEventTypes.length === 0}
          <p class="text-muted-foreground text-xs">No event types available yet.</p>
        {:else}
          <div class="space-y-1">
            {#each state.availableEventTypes as eventType (eventType)}
              <label class="hover:bg-muted flex items-center gap-2 rounded px-1 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={state.draftFilters.eventTypes.includes(eventType)}
                  onchange={(event) => {
                    const target = event.currentTarget as HTMLInputElement;
                    toggleEventType(eventType, target.checked);
                  }}
                />
                <span class="truncate">{eventType}</span>
              </label>
            {/each}
          </div>
        {/if}
      </div>
    </details>
  </Label>

  <Label class="grid gap-1 text-xs">
    Payload text
    <Input
      value={state.draftFilters.q}
      placeholder="text in payload"
      oninput={(event) => {
        onTextInput('q', event);
      }}
      data-testid="filter-search"
    />
  </Label>

  <div class="col-span-full flex flex-wrap items-center justify-end gap-2 pt-1">
    {#if state.hasUnappliedFilterChanges}
      <span class="mr-auto text-xs text-muted-foreground" data-testid="filter-unapplied">Unapplied changes</span>
    {/if}

    <Button
      type="submit"
      size="sm"
      disabled={state.loading || !state.hasUnappliedFilterChanges}
      data-testid="filter-apply"
    >
      Apply
    </Button>
    <Button
      type="button"
      variant="outline"
      size="sm"
      onclick={() => {
        void state.resetFilters();
      }}
      data-testid="filter-reset"
    >
      Reset
    </Button>
  </div>
</form>
