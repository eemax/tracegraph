import type { NormalizedEvent } from '@observe-graph/shared';

export interface UiFilters {
  from: string;
  to: string;
  event: string;
  stage: string;
  origin: string;
  traceId: string;
  chatId: string;
  q: string;
}

export interface TimelineItem {
  event: NormalizedEvent;
  depth: number;
}

export interface EventTypeGroup {
  key: string;
  label: string;
  depth: number;
  count: number;
  isLeaf: boolean;
}

export const missingTraceGroupKey = '__missing_trace__';

function getTimestampMs(event: NormalizedEvent): number {
  const ms = Date.parse(event.timestamp);
  return Number.isNaN(ms) ? 0 : ms;
}

export function getEventType(event: NormalizedEvent): string {
  const derivedType = event.derived?.eventType?.trim();
  if (derivedType) {
    return derivedType;
  }

  const eventName = event.event.trim();
  if (eventName) {
    return eventName;
  }

  return 'unknown';
}

interface MutableEventTypeNode {
  key: string;
  label: string;
  depth: number;
  count: number;
  isLeaf: boolean;
  children: Map<string, MutableEventTypeNode>;
}

function sortByLabel(a: MutableEventTypeNode, b: MutableEventTypeNode): number {
  return a.label.localeCompare(b.label);
}

function getSingleChild(node: MutableEventTypeNode): MutableEventTypeNode | undefined {
  if (node.children.size !== 1) {
    return undefined;
  }
  return [...node.children.values()][0];
}

export function buildEventTypeGroups(events: NormalizedEvent[]): EventTypeGroup[] {
  const rootChildren = new Map<string, MutableEventTypeNode>();

  for (const event of events) {
    const type = getEventType(event);
    const parts = type.split('.').map((part) => part.trim()).filter(Boolean);
    const safeParts = parts.length > 0 ? parts : ['unknown'];

    let parentChildren = rootChildren;
    const path: string[] = [];

    for (let index = 0; index < safeParts.length; index += 1) {
      const part = safeParts[index];
      path.push(part);
      const key = path.join('.');

      let node = parentChildren.get(part);
      if (!node) {
        node = {
          key,
          label: part,
          depth: index,
          count: 0,
          isLeaf: false,
          children: new Map<string, MutableEventTypeNode>()
        };
        parentChildren.set(part, node);
      }

      node.count += 1;
      if (index === safeParts.length - 1) {
        node.isLeaf = true;
      }

      parentChildren = node.children;
    }
  }

  const out: EventTypeGroup[] = [];
  const pushCompressedNode = (node: MutableEventTypeNode, depth: number): void => {
    let current = node;
    const labels = [node.label];

    // Compress linear paths so the group list does not repeat every dot segment.
    while (!current.isLeaf) {
      const onlyChild = getSingleChild(current);
      if (!onlyChild) {
        break;
      }
      current = onlyChild;
      labels.push(current.label);
    }

    out.push({
      key: current.key,
      label: labels.join('.'),
      depth,
      count: current.count,
      isLeaf: current.isLeaf
    });

    const sortedChildren = [...current.children.values()].sort(sortByLabel);
    for (const child of sortedChildren) {
      pushCompressedNode(child, depth + 1);
    }
  };

  const sortedRoots = [...rootChildren.values()].sort(sortByLabel);
  for (const rootNode of sortedRoots) {
    pushCompressedNode(rootNode, 0);
  }

  return out;
}

export function getTraceGroupKey(event: NormalizedEvent): string {
  const traceId = event.trace?.traceId?.trim();
  if (traceId) {
    return traceId;
  }
  return missingTraceGroupKey;
}

export function buildTraceGroups(events: NormalizedEvent[]): EventTypeGroup[] {
  const byTrace = new Map<string, { count: number; lastSeq: number }>();

  for (const event of events) {
    const key = getTraceGroupKey(event);
    const existing = byTrace.get(key);
    if (!existing) {
      byTrace.set(key, { count: 1, lastSeq: event.seq });
      continue;
    }
    existing.count += 1;
    existing.lastSeq = Math.max(existing.lastSeq, event.seq);
  }

  return [...byTrace.entries()]
    .sort(([aKey, a], [bKey, b]) => b.lastSeq - a.lastSeq || aKey.localeCompare(bKey))
    .map(([key, meta]) => ({
      key,
      label: key === missingTraceGroupKey ? 'no-trace' : key,
      depth: 0,
      count: meta.count,
      isLeaf: true
    }));
}

function looksLikeStructuredJson(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return false;
  }
  const start = trimmed[0];
  const end = trimmed[trimmed.length - 1];
  return (start === '{' && end === '}') || (start === '[' && end === ']');
}

function parseIfJsonString(value: string): unknown {
  if (!looksLikeStructuredJson(value)) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function expandStringifiedJson(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = parseIfJsonString(value);
    if (parsed === value) {
      return value;
    }
    return expandStringifiedJson(parsed, depth + 1);
  }

  if (Array.isArray(value)) {
    return value.map((item) => expandStringifiedJson(item, depth + 1));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record).map(([key, nestedValue]) => [key, expandStringifiedJson(nestedValue, depth + 1)])
    );
  }

  return value;
}

export function toPrettyInspectorJson(value: Record<string, unknown>): string {
  const expanded = expandStringifiedJson(value);
  return JSON.stringify(expanded, null, 2);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function highlightJsonSyntax(prettyJson: string): string {
  const escaped = escapeHtml(prettyJson);
  return escaped.replace(
    /(&quot;(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\&]|&(?!quot;))*&quot;\s*:|&quot;(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\&]|&(?!quot;))*&quot;|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g,
    (token) => {
      if (token.startsWith('&quot;') && token.endsWith(':')) {
        return `<span class="json-key">${token}</span>`;
      }
      if (token.startsWith('&quot;')) {
        return `<span class="json-string">${token}</span>`;
      }
      if (token === 'true' || token === 'false') {
        return `<span class="json-boolean">${token}</span>`;
      }
      if (token === 'null') {
        return `<span class="json-null">${token}</span>`;
      }
      return `<span class="json-number">${token}</span>`;
    }
  );
}

function toIsoFromLocalInput(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

export function buildQueryString(filters: UiFilters, cursor?: string | null, limit = 300): string {
  const params = new URLSearchParams();
  params.set('limit', String(limit));

  if (cursor) {
    params.set('cursor', cursor);
  }

  const from = toIsoFromLocalInput(filters.from);
  const to = toIsoFromLocalInput(filters.to);

  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (filters.event.trim()) params.set('event', filters.event.trim());
  if (filters.stage.trim()) params.set('stage', filters.stage.trim());
  if (filters.origin.trim()) params.set('origin', filters.origin.trim());
  if (filters.traceId.trim()) params.set('traceId', filters.traceId.trim());
  if (filters.chatId.trim()) params.set('chatId', filters.chatId.trim());
  if (filters.q.trim()) params.set('q', filters.q.trim());

  return params.toString();
}

export function eventMatchesFilters(event: NormalizedEvent, filters: UiFilters): boolean {
  if (filters.event.trim() && event.event !== filters.event.trim()) {
    return false;
  }
  if (filters.stage.trim() && event.stage !== filters.stage.trim()) {
    return false;
  }
  if (filters.origin.trim() && event.trace?.origin !== filters.origin.trim()) {
    return false;
  }
  if (filters.traceId.trim() && event.trace?.traceId !== filters.traceId.trim()) {
    return false;
  }
  if (filters.chatId.trim() && event.chatId !== filters.chatId.trim()) {
    return false;
  }
  if (filters.from) {
    const fromMs = new Date(filters.from).getTime();
    if (!Number.isNaN(fromMs) && getTimestampMs(event) < fromMs) {
      return false;
    }
  }
  if (filters.to) {
    const toMs = new Date(filters.to).getTime();
    if (!Number.isNaN(toMs) && getTimestampMs(event) > toMs) {
      return false;
    }
  }
  if (filters.q.trim()) {
    const q = filters.q.trim().toLowerCase();
    const haystack = JSON.stringify(event.raw).toLowerCase();
    if (!haystack.includes(q)) {
      return false;
    }
  }
  return true;
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

export function buildTraceTimeline(events: NormalizedEvent[]): TimelineItem[] {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const bySpan = new Map<string, NormalizedEvent>();

  for (const event of ordered) {
    const spanId = event.trace?.spanId;
    if (spanId) {
      bySpan.set(spanId, event);
    }
  }

  const getDepth = (event: NormalizedEvent): number => {
    let depth = 0;
    let currentParent = event.trace?.parentSpanId ?? null;
    const seen = new Set<string>();

    while (currentParent) {
      if (seen.has(currentParent)) {
        break;
      }
      seen.add(currentParent);
      const parent = bySpan.get(currentParent);
      if (!parent) {
        break;
      }
      depth += 1;
      currentParent = parent.trace?.parentSpanId ?? null;
    }

    return depth;
  };

  return ordered.map((event) => ({
    event,
    depth: getDepth(event)
  }));
}
