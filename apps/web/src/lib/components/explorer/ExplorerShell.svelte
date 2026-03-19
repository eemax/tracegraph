<script lang="ts">
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Resizable from '$lib/components/ui/resizable/index.js';
  import * as Sheet from '$lib/components/ui/sheet/index.js';
  import type { ExplorerState } from '$lib/state/explorer.svelte';
  import EventVirtualList from './EventVirtualList.svelte';
  import FilterPanel from './FilterPanel.svelte';
  import GroupSidebar from './GroupSidebar.svelte';
  import InspectorPanel from './InspectorPanel.svelte';
  import SourceStatusStrip from './SourceStatusStrip.svelte';
  import TopbarStats from './TopbarStats.svelte';

  let { state }: { state: ExplorerState } = $props();
</script>

<div class="flex h-screen flex-col gap-2 p-2">
  <TopbarStats {state} />

  <div class="hidden min-h-0 flex-1 lg:block">
    <Resizable.ResizablePaneGroup direction="horizontal" class="h-full gap-2">
      <Resizable.ResizablePane defaultSize={64} minSize={35}>
        <section class="flex h-full min-h-0 flex-col rounded-xl border bg-card text-card-foreground shadow-xs" aria-label="Event feed">
          <header class="flex items-center justify-between gap-2 px-4 py-2">
            <h2 class="text-xs font-semibold uppercase tracking-wide">Event Feed</h2>
            <Badge variant={state.loading ? 'secondary' : 'default'}>{state.loading ? 'Loading...' : state.liveLabel}</Badge>
          </header>

          <FilterPanel {state} />
          <SourceStatusStrip {state} />

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

      <Resizable.ResizablePane defaultSize={36} minSize={25}>
        <InspectorPanel {state} />
      </Resizable.ResizablePane>
    </Resizable.ResizablePaneGroup>
  </div>

  <div class="min-h-0 flex-1 lg:hidden">
    <div class="grid h-full grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
      <section class="flex min-h-0 flex-col rounded-xl border bg-card text-card-foreground shadow-xs" aria-label="Event feed">
        <header class="flex items-center justify-between gap-2 px-4 py-2">
          <h2 class="text-xs font-semibold uppercase tracking-wide">Event Feed</h2>
          <div class="flex items-center gap-2">
            <Badge variant={state.loading ? 'secondary' : 'default'}>{state.loading ? 'Loading...' : state.liveLabel}</Badge>
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
          </div>
        </header>

        <FilterPanel {state} />
        <SourceStatusStrip {state} />
        <EventVirtualList {state} />
      </section>

      <InspectorPanel {state} />
    </div>
  </div>
</div>

<Sheet.Sheet bind:open={state.mobileGroupsOpen}>
  <Sheet.SheetContent side="left" class="w-full max-w-sm p-0 sm:max-w-sm" aria-label="Group selector">
    <Sheet.SheetHeader class="border-b px-4 py-3">
      <Sheet.SheetTitle>Groups</Sheet.SheetTitle>
      <Sheet.SheetDescription>Switch grouping mode and pick a visible event set.</Sheet.SheetDescription>
    </Sheet.SheetHeader>

    <div class="min-h-0 h-full">
      <GroupSidebar {state} />
    </div>
  </Sheet.SheetContent>
</Sheet.Sheet>
