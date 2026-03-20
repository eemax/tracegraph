<script lang="ts">
  import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
  import * as Tabs from '$lib/components/ui/tabs/index.js';
  import {
    Table,
    TableBody,
    TableCell,
    TableRow
  } from '$lib/components/ui/table/index.js';
  import type { ExplorerState } from '$lib/state/explorer.svelte';
  import { formatTimestamp, getEventType } from '$lib/ui';

  let { state }: { state: ExplorerState } = $props();

  function registerInspectorPane(node: HTMLElement): { destroy: () => void } {
    state.setInspectorPane(node);

    return {
      destroy: () => {
        state.setInspectorPane(null);
      }
    };
  }
</script>

<section
  class="flex h-full min-h-0 flex-col rounded-xl border bg-card text-card-foreground shadow-xs"
  aria-label="Event inspector"
  use:registerInspectorPane
  tabindex="-1"
>
  <header class="flex items-center justify-between gap-2 border-b px-4 py-2">
    <h2 class="text-xs font-semibold uppercase tracking-wide">Event Inspector</h2>
    {#if !state.selectedEvent}
      <span class="text-xs text-muted-foreground">No event selected</span>
    {/if}
  </header>

  {#if state.selectedEvent}
    {@const eventType = getEventType(state.selectedEvent)}
    <div class="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs">
      <Badge variant="secondary">{eventType}</Badge>
      {#if state.selectedEvent.event !== eventType}
        <span class="truncate">{state.selectedEvent.event}</span>
      {/if}
      <span class="text-muted-foreground">{formatTimestamp(state.selectedEvent.timestamp)}</span>
    </div>
  {/if}

  <Tabs.Root bind:value={state.inspectorTab} class="min-h-0 flex-1 p-3" data-testid="inspector-tabs">
    <Tabs.List variant="line" class="w-full justify-start">
      <Tabs.Trigger value="parsed">Parsed</Tabs.Trigger>
      <Tabs.Trigger value="raw" data-testid="tab-raw">Raw JSON</Tabs.Trigger>
      <Tabs.Trigger value="trace" data-testid="tab-trace">Trace</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="parsed" class="min-h-0 flex-1">
      {#if !state.selectedEvent}
        <div class="pt-3">
          <Alert>
            <AlertTitle>No selected event</AlertTitle>
            <AlertDescription>Select an event from the feed to inspect parsed fields.</AlertDescription>
          </Alert>
        </div>
      {:else}
        <ScrollArea class="h-full pt-3">
          <Table>
            <TableBody>
              {#each state.parsedFields as field (field.label)}
                <TableRow>
                  <TableCell class="w-40 text-xs font-medium text-muted-foreground">{field.label}</TableCell>
                  <TableCell class="text-xs">{field.value}</TableCell>
                </TableRow>
              {/each}
            </TableBody>
          </Table>
        </ScrollArea>
      {/if}
    </Tabs.Content>

    <Tabs.Content value="raw" class="min-h-0 flex-1" data-testid="tab-content-raw">
      {#if !state.selectedEvent}
        <div class="pt-3">
          <Alert>
            <AlertTitle>No selected event</AlertTitle>
            <AlertDescription>Select an event from the feed to inspect raw payloads.</AlertDescription>
          </Alert>
        </div>
      {:else}
        <ScrollArea class="h-full pt-3">
          <pre class="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs leading-5"><code>{@html state.highlightedRawInspectorJson}</code></pre>
        </ScrollArea>
      {/if}
    </Tabs.Content>

    <Tabs.Content value="trace" class="min-h-0 flex-1" data-testid="tab-content-trace">
      {#if !state.selectedEvent}
        <div class="pt-3">
          <Alert>
            <AlertTitle>No selected event</AlertTitle>
            <AlertDescription>Select an event from the feed to inspect trace flow.</AlertDescription>
          </Alert>
        </div>
      {:else if state.traceTimeline.length === 0}
        <div class="pt-3">
          <Alert>
            <AlertTitle>No timeline available</AlertTitle>
            <AlertDescription>This event does not have a loaded trace timeline yet.</AlertDescription>
          </Alert>
        </div>
      {:else}
        <ScrollArea class="h-full pt-3">
          <div class="space-y-2">
            {#each state.traceTimeline as item (item.event.id)}
              <div class="rounded-md border border-border p-2 text-xs" style={`margin-left: ${item.depth * 0.9}rem`}>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-muted-foreground">{formatTimestamp(item.event.timestamp)}</span>
                  <strong>{item.event.event}</strong>
                  <span class="text-muted-foreground">{item.event.trace?.spanId ?? 'span:unknown'}</span>
                </div>
              </div>
            {/each}
          </div>
        </ScrollArea>
      {/if}
    </Tabs.Content>
  </Tabs.Root>
</section>
