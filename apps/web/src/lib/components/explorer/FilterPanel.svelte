<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import type { ExplorerState } from '$lib/state/explorer.svelte';
  import type { UiFilters } from '$lib/ui';

  let { state }: { state: ExplorerState } = $props();

  function onInput(key: keyof UiFilters, event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    state.setFilter(key, target.value);
  }
</script>

<form
  class="grid grid-cols-1 gap-2 border-y px-3 py-2 sm:grid-cols-2 lg:grid-cols-4"
  onsubmit={(event) => {
    event.preventDefault();
    void state.applyFilters();
  }}
  data-testid="filter-form"
>
  <Label class="grid gap-1 text-xs">
    Event
    <Input
      value={state.filters.event}
      placeholder="tool.workflow.progress"
      oninput={(event) => {
        onInput('event', event);
      }}
      data-testid="filter-event"
    />
  </Label>

  <Label class="grid gap-1 text-xs">
    Stage
    <Input
      value={state.filters.stage}
      placeholder="completed"
      oninput={(event) => {
        onInput('stage', event);
      }}
    />
  </Label>

  <Label class="grid gap-1 text-xs">
    Origin
    <Input
      value={state.filters.origin}
      placeholder="provider"
      oninput={(event) => {
        onInput('origin', event);
      }}
    />
  </Label>

  <Label class="grid gap-1 text-xs">
    Trace
    <Input
      value={state.filters.traceId}
      placeholder="trace_..."
      oninput={(event) => {
        onInput('traceId', event);
      }}
    />
  </Label>

  <Label class="grid gap-1 text-xs">
    Chat
    <Input
      value={state.filters.chatId}
      placeholder="8512871156"
      oninput={(event) => {
        onInput('chatId', event);
      }}
    />
  </Label>

  <Label class="grid gap-1 text-xs">
    Search
    <Input
      value={state.filters.q}
      placeholder="text in payload"
      oninput={(event) => {
        onInput('q', event);
      }}
      data-testid="filter-search"
    />
  </Label>

  <Label class="grid gap-1 text-xs">
    From
    <Input
      type="datetime-local"
      value={state.filters.from}
      oninput={(event) => {
        onInput('from', event);
      }}
    />
  </Label>

  <Label class="grid gap-1 text-xs">
    To
    <Input
      type="datetime-local"
      value={state.filters.to}
      oninput={(event) => {
        onInput('to', event);
      }}
    />
  </Label>

  <div class="col-span-full flex flex-wrap justify-end gap-2 pt-1">
    <Button type="submit" size="sm" disabled={state.loading} data-testid="filter-apply">Apply</Button>
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
