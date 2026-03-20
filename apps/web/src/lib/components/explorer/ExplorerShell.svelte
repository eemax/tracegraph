<script lang="ts">
  import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Resizable from '$lib/components/ui/resizable/index.js';
  import * as Sheet from '$lib/components/ui/sheet/index.js';
  import type { ExplorerState } from '$lib/state/explorer.svelte';
  import EventVirtualList from './EventVirtualList.svelte';
  import GroupSidebar from './GroupSidebar.svelte';
  import InspectorPanel from './InspectorPanel.svelte';
  import TopbarStats from './TopbarStats.svelte';

  let { state }: { state: ExplorerState } = $props();
</script>

<div class="flex h-screen flex-col gap-2 p-2">
  <TopbarStats {state} />

  {#if state.errorMessage}
    <section aria-label="Explorer errors" data-testid="explorer-error">
      <Alert variant="destructive">
        <AlertTitle>Explorer synchronization error</AlertTitle>
        <AlertDescription>{state.errorMessage}</AlertDescription>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            on:click={() => {
              void state.retryList();
            }}
          >
            Retry list
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            on:click={() => {
              state.reconnectStream();
            }}
          >
            Reconnect stream
          </Button>
        </div>
      </Alert>
    </section>
  {/if}

  <div class="hidden min-h-0 flex-1 lg:block">
    <Resizable.ResizablePaneGroup direction="horizontal" class="h-full gap-2">
      <Resizable.ResizablePane defaultSize={40} minSize={35}>
        <section class="flex h-full min-h-0 flex-col rounded-xl border bg-card text-card-foreground shadow-xs" aria-label="Event feed">
          <header class="flex items-center justify-between gap-2 px-4 py-2">
            <h2 class="text-xs font-semibold uppercase tracking-wide">Event Feed</h2>
          </header>

          <div class="min-h-0 flex-1">
            <Resizable.ResizablePaneGroup direction="horizontal" class="h-full">
              <Resizable.ResizablePane defaultSize={30} minSize={18} maxSize={45}>
                <div class="h-full border-r">
                  <GroupSidebar {state} />
                </div>
              </Resizable.ResizablePane>

              <Resizable.ResizableHandle withHandle />

              <Resizable.ResizablePane defaultSize={70} minSize={55}>
                <EventVirtualList {state} />
              </Resizable.ResizablePane>
            </Resizable.ResizablePaneGroup>
          </div>
        </section>
      </Resizable.ResizablePane>

      <Resizable.ResizableHandle withHandle />

      <Resizable.ResizablePane defaultSize={60} minSize={25}>
        <InspectorPanel {state} />
      </Resizable.ResizablePane>
    </Resizable.ResizablePaneGroup>
  </div>

  <div class="min-h-0 flex-1 lg:hidden">
    <section class="flex h-full min-h-0 flex-col rounded-xl border bg-card text-card-foreground shadow-xs" aria-label="Event feed">
      <header class="flex items-center justify-between gap-2 px-4 py-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide">Event Feed</h2>
        <div class="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            on:click={() => {
              state.toggleMobileGroups(true);
            }}
          >
            Groups
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={state.selectedEvent === null}
            on:click={() => {
              state.toggleMobileInspector(true);
            }}
            data-testid="mobile-inspect"
          >
            Inspect
          </Button>
        </div>
      </header>

      <EventVirtualList {state} />
    </section>
  </div>
</div>

<Sheet.Sheet bind:open={state.mobileGroupsOpen}>
  <Sheet.SheetContent side="left" class="w-full max-w-sm p-0 sm:max-w-sm" aria-label="Group selector">
    <Sheet.SheetHeader class="border-b px-4 py-3">
      <Sheet.SheetTitle>Groups</Sheet.SheetTitle>
      <Sheet.SheetDescription>Browse trace groups and counts.</Sheet.SheetDescription>
    </Sheet.SheetHeader>

    <div class="min-h-0 h-full">
      <GroupSidebar {state} />
    </div>
  </Sheet.SheetContent>
</Sheet.Sheet>

<Sheet.Sheet bind:open={state.mobileInspectorOpen}>
  <Sheet.SheetContent side="bottom" class="h-[88vh] p-0" aria-label="Mobile inspector">
    <Sheet.SheetHeader class="border-b px-4 py-3">
      <Sheet.SheetTitle>Inspector</Sheet.SheetTitle>
      <Sheet.SheetDescription>Review the selected event and return to feed at any time.</Sheet.SheetDescription>
    </Sheet.SheetHeader>

    <div class="h-[calc(88vh-4.5rem)] p-2">
      <InspectorPanel {state} />
    </div>
  </Sheet.SheetContent>
</Sheet.Sheet>
