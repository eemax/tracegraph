<script lang="ts">
  import { onMount } from 'svelte';
  import type { EventListResponse, NormalizedEvent, SseEnvelope, SourceStatus } from '@observe-graph/shared';
  import {
    buildEventTypeGroups,
    buildQueryString,
    buildTraceTimeline,
    eventMatchesFilters,
    formatTimestamp,
    getEventType,
    toPrettyInspectorJson,
    type EventTypeGroup,
    type TimelineItem,
    type UiFilters
  } from '$lib/ui';

  type InspectorTab = 'parsed' | 'raw' | 'trace';
  type ParsedField = { label: string; value: string };

  const allTypesKey = '__all_types__';
  const rowHeight = 50;
  const overscan = 10;
  const notAvailable = 'n/a';

  let filters: UiFilters = {
    from: '',
    to: '',
    event: '',
    stage: '',
    origin: '',
    traceId: '',
    chatId: '',
    q: ''
  };

  let events: NormalizedEvent[] = [];
  let nextCursor: string | null = null;
  let total = 0;
  let dropped = 0;
  let loading = false;
  let loadingMore = false;
  let sources: Record<string, SourceStatus> = {};

  let selectedType = allTypesKey;
  let typeGroups: EventTypeGroup[] = [];
  let filteredEvents: NormalizedEvent[] = [];

  let selectedId: string | null = null;
  let selectedEvent: NormalizedEvent | null = null;
  let inspectorTab: InspectorTab = 'parsed';
  let parsedFields: ParsedField[] = [];
  let rawInspectorJson = '';

  let traceTimeline: TimelineItem[] = [];
  let currentTraceRequest: string | null = null;

  let eventSource: EventSource | null = null;

  let listPane: HTMLDivElement | null = null;
  let scrollTop = 0;
  let viewportHeight = 520;

  $: typeGroups = buildEventTypeGroups(events);
  $: filteredEvents =
    selectedType === allTypesKey ? events : events.filter((event) => isEventInTypeGroup(event, selectedType));

  $: {
    if (selectedType !== allTypesKey && !typeGroups.some((group) => group.key === selectedType)) {
      selectedType = allTypesKey;
    }
  }

  $: {
    const hasSelected = selectedId !== null && filteredEvents.some((item) => item.id === selectedId);
    if (filteredEvents.length === 0) {
      selectedId = null;
    } else if (!hasSelected) {
      selectedId = filteredEvents[0].id;
    }
  }

  $: selectedEvent = events.find((event) => event.id === selectedId) ?? null;

  $: {
    const traceId = selectedEvent?.trace?.traceId;
    if (!traceId) {
      traceTimeline = [];
      currentTraceRequest = null;
    } else if (traceId !== currentTraceRequest) {
      currentTraceRequest = traceId;
      void loadTrace(traceId);
    }
  }

  $: parsedFields = selectedEvent ? buildParsedFields(selectedEvent) : [];
  $: rawInspectorJson = selectedEvent ? toPrettyInspectorJson(selectedEvent.raw) : '';

  $: totalRows = filteredEvents.length;
  $: startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  $: endIndex = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  $: visibleRows = filteredEvents.slice(startIndex, endIndex);
  $: topPadding = startIndex * rowHeight;
  $: bottomPadding = Math.max(0, (totalRows - endIndex) * rowHeight);

  function toDisplay(value: unknown): string {
    if (value === undefined || value === null || value === '') {
      return notAvailable;
    }
    return String(value);
  }

  function buildParsedFields(event: NormalizedEvent): ParsedField[] {
    const fields: ParsedField[] = [
      { label: 'Timestamp', value: formatTimestamp(event.timestamp) },
      { label: 'Event', value: event.event },
      { label: 'Event Type', value: toDisplay(event.derived?.eventType) },
      { label: 'Stage', value: event.stage ?? notAvailable },
      { label: 'Source', value: event.sourceLabel },
      { label: 'Trace ID', value: event.trace?.traceId ?? notAvailable },
      { label: 'Span ID', value: event.trace?.spanId ?? notAvailable },
      { label: 'Parent Span', value: event.trace?.parentSpanId ?? notAvailable },
      { label: 'Origin', value: event.trace?.origin ?? notAvailable },
      { label: 'Chat ID', value: event.chatId ?? notAvailable },
      { label: 'Message ID', value: event.messageId ?? notAvailable },
      { label: 'Sender ID', value: event.senderId ?? notAvailable }
    ];

    if (event.derived) {
      fields.push(
        { label: 'Conversation ID', value: toDisplay(event.derived.conversationId) },
        { label: 'Decision', value: toDisplay(event.derived.decision) },
        { label: 'Result Type', value: toDisplay(event.derived.resultType) },
        { label: 'Tool', value: toDisplay(event.derived.tool) },
        { label: 'Success', value: toDisplay(event.derived.success) },
        { label: 'Attempt', value: toDisplay(event.derived.attempt) },
        { label: 'Max Attempts', value: toDisplay(event.derived.maxAttempts) },
        { label: 'HTTP Status', value: toDisplay(event.derived.statusCode) },
        { label: 'Request OK', value: toDisplay(event.derived.ok) },
        { label: 'Model', value: toDisplay(event.derived.model) },
        { label: 'Progress Type', value: toDisplay(event.derived.progressType) },
        { label: 'Progress State', value: toDisplay(event.derived.progressState) },
        { label: 'Progress Step', value: toDisplay(event.derived.step) },
        { label: 'Elapsed (ms)', value: toDisplay(event.derived.elapsedMs) },
        { label: 'Progress Message', value: toDisplay(event.derived.progressMessage) },
        { label: 'Text Preview', value: toDisplay(event.derived.textPreview) },
        { label: 'Output Preview', value: toDisplay(event.derived.outputPreview) }
      );
    }

    return fields.filter((field) => field.value !== notAvailable);
  }

  function mergeUniqueTop(existing: NormalizedEvent[], incoming: NormalizedEvent[]): NormalizedEvent[] {
    const seen = new Set<string>();
    const out: NormalizedEvent[] = [];

    for (const item of [...incoming, ...existing]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
    }

    out.sort((a, b) => b.seq - a.seq);
    return out;
  }

  function resetListScroll(): void {
    scrollTop = 0;
    if (listPane) {
      listPane.scrollTop = 0;
    }
  }

  async function fetchEvents(cursor?: string | null, append = false): Promise<void> {
    if (append) {
      loadingMore = true;
    } else {
      loading = true;
    }

    try {
      const query = buildQueryString(filters, cursor);
      const response = await fetch(`/api/events?${query}`);
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as EventListResponse;

      events = append ? mergeUniqueTop(events, payload.items) : payload.items;
      nextCursor = payload.nextCursor;
      total = payload.total;
      dropped = payload.dropped;
    } finally {
      loading = false;
      loadingMore = false;
    }
  }

  async function loadTrace(traceId: string): Promise<void> {
    const response = await fetch(`/api/events?${buildQueryString({ ...filters, traceId }, null, 500)}`);
    if (!response.ok) {
      traceTimeline = [];
      return;
    }

    const payload = (await response.json()) as EventListResponse;
    traceTimeline = buildTraceTimeline(payload.items);
  }

  function applyFilters(): void {
    selectedType = allTypesKey;
    nextCursor = null;
    resetListScroll();
    void fetchEvents(null, false);
  }

  function resetFilters(): void {
    filters = {
      from: '',
      to: '',
      event: '',
      stage: '',
      origin: '',
      traceId: '',
      chatId: '',
      q: ''
    };
    applyFilters();
  }

  function selectType(type: string): void {
    selectedType = type;
    resetListScroll();
  }

  function isEventInTypeGroup(event: NormalizedEvent, groupKey: string): boolean {
    const type = getEventType(event);
    return type === groupKey || type.startsWith(`${groupKey}.`);
  }

  function onScroll(event: Event): void {
    const target = event.currentTarget as HTMLDivElement;
    scrollTop = target.scrollTop;

    const threshold = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (threshold < 220 && nextCursor && !loadingMore) {
      void fetchEvents(nextCursor, true);
    }
  }

  function moveSelection(direction: 1 | -1): void {
    if (filteredEvents.length === 0) {
      return;
    }

    const index = selectedId ? filteredEvents.findIndex((item) => item.id === selectedId) : -1;
    const nextIndex = index < 0 ? 0 : Math.max(0, Math.min(filteredEvents.length - 1, index + direction));
    selectedId = filteredEvents[nextIndex].id;
  }

  function onKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof HTMLElement) {
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
        return;
      }
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelection(1);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(-1);
    }
  }

  function handleSse(envelope: SseEnvelope): void {
    if (envelope.type === 'snapshot') {
      events = mergeUniqueTop(events, envelope.payload.items);
      total = Math.max(total, envelope.payload.total);
      dropped = Math.max(dropped, envelope.payload.dropped);
      sources = Object.fromEntries(envelope.payload.sources.map((status) => [status.sourceId, status]));
      return;
    }

    if (envelope.type === 'source_status') {
      sources = {
        ...sources,
        [envelope.payload.sourceId]: envelope.payload
      };
      return;
    }

    if (envelope.type === 'append') {
      if (!eventMatchesFilters(envelope.payload, filters)) {
        return;
      }
      events = mergeUniqueTop(events, [envelope.payload]);
      total += 1;
    }
  }

  onMount(() => {
    void fetchEvents(null, false);

    eventSource = new EventSource('/api/stream');
    eventSource.onmessage = (event) => {
      const envelope = JSON.parse(event.data) as SseEnvelope;
      handleSse(envelope);
    };

    eventSource.onerror = () => {
      // Browser EventSource handles reconnect automatically.
    };

    window.addEventListener('keydown', onKeyDown);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        viewportHeight = entry.contentRect.height;
      }
    });

    if (listPane) {
      resizeObserver.observe(listPane);
    }

    return () => {
      eventSource?.close();
      window.removeEventListener('keydown', onKeyDown);
      resizeObserver.disconnect();
    };
  });
</script>

<svelte:head>
  <title>Observe Graph</title>
</svelte:head>

<div class="app-shell">
  <header class="topbar">
    <div class="title-group">
      <h1>Observe Graph</h1>
      <p>Compact inspection workspace for live JSONL observability events.</p>
    </div>

    <div class="stats" aria-live="polite">
      <span>Total {total}</span>
      <span>Dropped {dropped}</span>
      <span>Loaded {events.length}</span>
      <span>Visible {filteredEvents.length}</span>
    </div>
  </header>

  <form
    class="filters"
    on:submit|preventDefault={() => {
      applyFilters();
    }}
  >
    <label>
      Event
      <input bind:value={filters.event} placeholder="tool.workflow.progress" />
    </label>

    <label>
      Stage
      <input bind:value={filters.stage} placeholder="completed" />
    </label>

    <label>
      Origin
      <input bind:value={filters.origin} placeholder="provider" />
    </label>

    <label>
      Trace
      <input bind:value={filters.traceId} placeholder="trace_..." />
    </label>

    <label>
      Chat
      <input bind:value={filters.chatId} placeholder="8512871156" />
    </label>

    <label>
      Search
      <input bind:value={filters.q} placeholder="text in payload" />
    </label>

    <label>
      From
      <input bind:value={filters.from} type="datetime-local" />
    </label>

    <label>
      To
      <input bind:value={filters.to} type="datetime-local" />
    </label>

    <div class="filter-actions">
      <button type="submit">Apply</button>
      <button type="button" class="ghost" on:click={resetFilters}>Reset</button>
    </div>
  </form>

  <section class="source-strip" aria-label="Source status">
    {#if Object.values(sources).length === 0}
      <span class="muted">Waiting for source status...</span>
    {:else}
      {#each Object.values(sources) as sourceStatus}
        <div class:healthy={sourceStatus.healthy} class="source-pill">
          <strong>{sourceStatus.sourceId}</strong>
          <span>{sourceStatus.healthy ? 'healthy' : 'degraded'}</span>
          <span>lines {sourceStatus.totalLines}</span>
          <span>malformed {sourceStatus.malformedLines}</span>
        </div>
      {/each}
    {/if}
  </section>

  <main class="workspace">
    <section class="events-pane" aria-label="Event feed">
      <div class="pane-head">
        <h2>Event Feed</h2>
        <span>{loading ? 'Loading...' : 'Live'}</span>
      </div>

      <div class="event-layout">
        <aside class="type-list" aria-label="Event type groups">
          <button
            class:type-selected={selectedType === allTypesKey}
            class="type-row"
            type="button"
            on:click={() => {
              selectType(allTypesKey);
            }}
            title="All event types"
          >
            <span class="type-name">All types</span>
            <strong>{events.length}</strong>
          </button>

          {#each typeGroups as group (group.key)}
            <button
              class:type-selected={selectedType === group.key}
              class="type-row"
              type="button"
              on:click={() => {
                selectType(group.key);
              }}
              title={group.key}
            >
              <span class="type-name" style={`padding-left: ${group.depth * 0.72}rem`}>{group.label}</span>
              <strong>{group.count}</strong>
            </button>
          {/each}

          {#if typeGroups.length === 0}
            <div class="muted">No event types yet.</div>
          {/if}
        </aside>

        <div class="list-wrap">
          <div class="list" bind:this={listPane} on:scroll={onScroll}>
            <div style={`height: ${topPadding}px;`} aria-hidden="true"></div>

            {#each visibleRows as row (row.id)}
              <button
                class:selected={selectedId === row.id}
                class="event-row"
                type="button"
                on:click={() => {
                  selectedId = row.id;
                }}
                title={`${row.sourceLabel} • ${row.event}`}
              >
                <div class="row-main">
                  <strong class="row-event">{row.event}</strong>
                  <span class="row-meta">
                    <span>{row.stage ?? 'n/a'}</span>
                    <span>{row.sourceLabel}</span>
                    <span>{row.trace?.origin ?? 'unknown'}</span>
                  </span>
                </div>
                <span class="row-time">{formatTimestamp(row.timestamp)}</span>
              </button>
            {/each}

            <div style={`height: ${bottomPadding}px;`} aria-hidden="true"></div>
          </div>

          {#if loadingMore}
            <div class="muted">Loading more...</div>
          {/if}
        </div>
      </div>
    </section>

    <section class="inspector" aria-label="Event inspector">
      <div class="pane-head">
        <h2>Event Inspector</h2>
        <span>{selectedEvent ? selectedEvent.id : 'No event selected'}</span>
      </div>

      {#if selectedEvent}
        <div class="selection-summary">
          <span class="summary-pill">{getEventType(selectedEvent)}</span>
          <span>{selectedEvent.event}</span>
          <span>{formatTimestamp(selectedEvent.timestamp)}</span>
        </div>
      {/if}

      <div class="tabs" role="tablist" aria-label="Inspector views">
        <button
          class:active={inspectorTab === 'parsed'}
          role="tab"
          type="button"
          on:click={() => {
            inspectorTab = 'parsed';
          }}
        >
          Parsed
        </button>
        <button
          class:active={inspectorTab === 'raw'}
          role="tab"
          type="button"
          on:click={() => {
            inspectorTab = 'raw';
          }}
        >
          Raw JSON
        </button>
        <button
          class:active={inspectorTab === 'trace'}
          role="tab"
          type="button"
          on:click={() => {
            inspectorTab = 'trace';
          }}
        >
          Trace
        </button>
      </div>

      {#if !selectedEvent}
        <div class="empty">Select an event from a type group.</div>
      {:else if inspectorTab === 'parsed'}
        <dl class="parsed-grid">
          {#each parsedFields as field (field.label)}
            <div>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          {/each}
        </dl>
      {:else if inspectorTab === 'raw'}
        <pre class="code">{rawInspectorJson}</pre>
      {:else}
        {#if traceTimeline.length === 0}
          <div class="empty">No timeline available for this trace.</div>
        {:else}
          <div class="timeline">
            {#each traceTimeline as item (item.event.id)}
              <div class="timeline-row" style={`padding-left: ${item.depth * 1.1}rem`}>
                <span class="timeline-time">{formatTimestamp(item.event.timestamp)}</span>
                <strong>{item.event.event}</strong>
                <span>{item.event.trace?.spanId ?? 'span:unknown'}</span>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </section>
  </main>
</div>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    min-height: 100vh;
    background: #f3f5f8;
    color: #111827;
    font-family: 'IBM Plex Sans', 'Avenir Next', 'Segoe UI', sans-serif;
  }

  .app-shell {
    height: 100vh;
    display: grid;
    grid-template-rows: auto auto auto minmax(0, 1fr);
    gap: 0.5rem;
    padding: 0.65rem;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    border: 1px solid #d6dde8;
    border-radius: 0.6rem;
    background: #ffffff;
    padding: 0.6rem 0.75rem;
  }

  .title-group h1 {
    margin: 0;
    font-size: 1rem;
    letter-spacing: 0.01em;
  }

  .title-group p {
    margin: 0.2rem 0 0;
    font-size: 0.74rem;
    color: #4b5563;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    font-size: 0.72rem;
    color: #374151;
  }

  .stats span {
    border: 1px solid #e1e7ef;
    border-radius: 999px;
    padding: 0.2rem 0.5rem;
    background: #f8fafc;
  }

  .filters {
    display: grid;
    grid-template-columns: repeat(9, minmax(0, 1fr));
    gap: 0.45rem;
    border: 1px solid #d6dde8;
    border-radius: 0.6rem;
    background: #ffffff;
    padding: 0.55rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.67rem;
    color: #4b5563;
    font-weight: 600;
  }

  input {
    width: 100%;
    border: 1px solid #d4dce8;
    border-radius: 0.42rem;
    background: #ffffff;
    color: #111827;
    padding: 0.35rem 0.45rem;
    font-size: 0.74rem;
    font-family: inherit;
  }

  input::placeholder {
    color: #9ca3af;
  }

  input:focus-visible,
  button:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 1px;
  }

  .filter-actions {
    display: flex;
    gap: 0.35rem;
    align-items: flex-end;
  }

  button {
    border: 1px solid #cfd8e5;
    border-radius: 0.42rem;
    background: #f8fafc;
    color: #1f2937;
    font-size: 0.72rem;
    font-family: inherit;
    padding: 0.36rem 0.62rem;
    cursor: pointer;
  }

  button:hover {
    background: #f1f5f9;
  }

  button.ghost {
    background: #ffffff;
  }

  .source-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    border: 1px solid #d6dde8;
    border-radius: 0.6rem;
    background: #ffffff;
    padding: 0.45rem 0.55rem;
  }

  .source-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid #f1b3b3;
    border-radius: 999px;
    padding: 0.15rem 0.52rem;
    font-size: 0.68rem;
    color: #8f2020;
    background: #fff5f5;
  }

  .source-pill.healthy {
    border-color: #b6e5c2;
    color: #166534;
    background: #f0fdf4;
  }

  .workspace {
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(360px, 0.8fr) minmax(0, 1.2fr);
    gap: 0.5rem;
  }

  .events-pane,
  .inspector {
    min-height: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid #d6dde8;
    border-radius: 0.6rem;
    background: #ffffff;
    overflow: hidden;
  }

  .pane-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    padding: 0.52rem 0.66rem;
    border-bottom: 1px solid #e5ebf3;
    background: #f8fafc;
  }

  .pane-head h2 {
    margin: 0;
    font-size: 0.76rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #1f2937;
  }

  .pane-head span {
    font-size: 0.69rem;
    color: #475569;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .event-layout {
    min-height: 0;
    display: grid;
    grid-template-columns: 210px minmax(0, 1fr);
    flex: 1;
  }

  .type-list {
    border-right: 1px solid #e5ebf3;
    padding: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.32rem;
    overflow: auto;
  }

  .type-row {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.45rem;
    padding: 0.3rem 0.45rem;
    border: 1px solid #e4e9f1;
    border-radius: 0.42rem;
    background: #ffffff;
    text-align: left;
    font-size: 0.71rem;
  }

  .type-row:hover {
    background: #f8fafc;
  }

  .type-row.type-selected {
    border-color: #9fb9e8;
    background: #edf3ff;
  }

  .type-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #1f2937;
  }

  .list-wrap {
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .list {
    min-height: 0;
    flex: 1;
    overflow: auto;
    padding: 0.3rem;
  }

  .event-row {
    width: 100%;
    height: 50px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.55rem;
    border: 1px solid #e3e8f0;
    border-radius: 0.45rem;
    margin-bottom: 0.24rem;
    padding: 0.32rem 0.45rem;
    background: #ffffff;
    text-align: left;
  }

  .event-row:hover {
    border-color: #9eb6de;
    background: #f8fbff;
  }

  .event-row.selected {
    border-color: #2563eb;
    background: #ecf3ff;
  }

  .row-main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
  }

  .row-event {
    display: block;
    font-size: 0.73rem;
    color: #0f172a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-meta {
    display: inline-flex;
    align-items: center;
    gap: 0.34rem;
    font-size: 0.64rem;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-time {
    flex-shrink: 0;
    margin-top: 0.04rem;
    font-size: 0.65rem;
    color: #64748b;
    white-space: nowrap;
  }

  .selection-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    padding: 0.44rem 0.66rem;
    border-bottom: 1px solid #e5ebf3;
    font-size: 0.69rem;
    color: #334155;
  }

  .summary-pill {
    border: 1px solid #9fb9e8;
    border-radius: 999px;
    padding: 0.08rem 0.45rem;
    background: #edf3ff;
    color: #1e3a8a;
    font-weight: 600;
  }

  .tabs {
    display: flex;
    gap: 0.35rem;
    padding: 0.44rem 0.66rem;
    border-bottom: 1px solid #e5ebf3;
  }

  .tabs button.active {
    border-color: #9fb9e8;
    background: #edf3ff;
  }

  .parsed-grid {
    margin: 0;
    padding: 0.66rem;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
    overflow: auto;
    align-content: start;
  }

  .parsed-grid dt {
    font-size: 0.64rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.08rem;
  }

  .parsed-grid dd {
    margin: 0;
    font-size: 0.73rem;
    color: #111827;
    word-break: break-word;
  }

  .code {
    margin: 0;
    flex: 1;
    overflow: auto;
    padding: 0.7rem;
    font-size: 0.72rem;
    color: #0f172a;
    background: #f8fafc;
    font-family: 'IBM Plex Mono', 'Fira Code', 'SF Mono', Menlo, monospace;
  }

  .timeline {
    padding: 0.58rem 0.66rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    overflow: auto;
  }

  .timeline-row {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    border-left: 1px solid #c7d7f0;
    padding-left: 0.52rem;
    font-size: 0.72rem;
    color: #1f2937;
  }

  .timeline-time {
    color: #64748b;
    font-size: 0.64rem;
    white-space: nowrap;
  }

  .empty,
  .muted {
    padding: 0.55rem 0.66rem;
    font-size: 0.7rem;
    color: #64748b;
  }

  @media (max-width: 1280px) {
    .filters {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .workspace {
      grid-template-columns: 1fr;
      grid-template-rows: 0.96fr 1.04fr;
    }
  }

  @media (max-width: 860px) {
    .app-shell {
      padding: 0.5rem;
      gap: 0.4rem;
    }

    .topbar {
      flex-direction: column;
    }

    .filters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .event-layout {
      grid-template-columns: 1fr;
    }

    .type-list {
      border-right: 0;
      border-bottom: 1px solid #e5ebf3;
      max-height: 140px;
    }

    .parsed-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
