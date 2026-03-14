import type { EventDerived, NormalizedEvent } from '@observe-graph/shared';

interface NormalizeContext {
  id: string;
  seq: number;
  sourceId: string;
  sourceLabel: string;
  line: number;
  offset: number;
  ingestedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asIdString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeTimestamp(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toISOString();
}

function compactDerived(input: EventDerived): EventDerived | undefined {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries) as EventDerived;
}

function compactText(value: string, maxLength = 280): string {
  return value.replace(/\\[nrt]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function parseJsonRecord(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value);
    return asRecord(parsed);
  } catch {
    return undefined;
  }
}

function decodeEscapedChar(input: string, index: number): { char: string; nextIndex: number } {
  const marker = input[index];
  if (marker !== '\\') {
    return { char: marker, nextIndex: index + 1 };
  }

  const next = input[index + 1];
  if (!next) {
    return { char: '', nextIndex: index + 1 };
  }

  if (next === 'n') return { char: '\n', nextIndex: index + 2 };
  if (next === 'r') return { char: '\r', nextIndex: index + 2 };
  if (next === 't') return { char: '\t', nextIndex: index + 2 };
  if (next === 'b') return { char: '\b', nextIndex: index + 2 };
  if (next === 'f') return { char: '\f', nextIndex: index + 2 };
  if (next === '"' || next === '\\' || next === '/') return { char: next, nextIndex: index + 2 };
  if (next === 'u') {
    const hex = input.slice(index + 2, index + 6);
    if (/^[0-9a-fA-F]{4}$/.test(hex)) {
      return { char: String.fromCharCode(Number.parseInt(hex, 16)), nextIndex: index + 6 };
    }
    return { char: 'u', nextIndex: index + 2 };
  }

  return { char: next, nextIndex: index + 2 };
}

function extractLooseStringField(input: string, field: string): string | undefined {
  const marker = `"${field}"`;
  const markerIndex = input.indexOf(marker);
  if (markerIndex < 0) {
    return undefined;
  }

  const colonIndex = input.indexOf(':', markerIndex + marker.length);
  if (colonIndex < 0) {
    return undefined;
  }

  let valueStart = colonIndex + 1;
  while (valueStart < input.length && /\s/.test(input[valueStart] ?? '')) {
    valueStart += 1;
  }

  if (input[valueStart] !== '"') {
    return undefined;
  }

  let cursor = valueStart + 1;
  let value = '';

  while (cursor < input.length) {
    const current = input[cursor];
    if (current === '"') {
      return value;
    }

    if (current === '\\') {
      const decoded = decodeEscapedChar(input, cursor);
      value += decoded.char;
      cursor = decoded.nextIndex;
      continue;
    }

    value += current;
    cursor += 1;
  }

  // Truncated JSON strings can end without a closing quote.
  return value.length > 0 ? value : undefined;
}

function summarizeLooseFunctionOutput(value: string): string | undefined {
  const parts: string[] = [];
  const summary = extractLooseStringField(value, 'summary');
  const stdout = extractLooseStringField(value, 'stdout');
  const content = extractLooseStringField(value, 'content');
  const text = extractLooseStringField(value, 'text');

  if (summary) parts.push(summary);
  if (stdout) parts.push(stdout);
  if (content) parts.push(content);
  if (text) parts.push(text);

  if (parts.length === 0) {
    return undefined;
  }

  return compactText(parts.join(' '), 220);
}

function pickBodyOutputText(rawValue: Record<string, unknown>): string | undefined {
  const body = asRecord(rawValue.body);
  if (!body) {
    return undefined;
  }

  const topLevelText = asString(body.output_text);
  if (topLevelText) {
    return topLevelText;
  }

  const output = body.output;
  if (!Array.isArray(output)) {
    return undefined;
  }

  for (const itemValue of output) {
    const item = asRecord(itemValue);
    if (!item) {
      continue;
    }

    const directText = asString(item.text);
    if (directText) {
      return directText;
    }

    const content = item.content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const contentItemValue of content) {
      const contentItem = asRecord(contentItemValue);
      if (!contentItem) {
        continue;
      }

      const nestedText = asString(contentItem.text) ?? asString(contentItem.output_text);
      if (nestedText) {
        return nestedText;
      }
    }
  }

  return undefined;
}

function summarizeFunctionOutputRecord(value: Record<string, unknown>): string | undefined {
  const parts: string[] = [];

  const summary = asString(value.summary);
  if (summary) {
    parts.push(summary);
  }

  const data = asRecord(value.data);
  if (data) {
    const stdout = asString(data.stdout);
    if (stdout) {
      parts.push(stdout);
    }

    const content = asString(data.content);
    if (content) {
      parts.push(content);
    }

    const text = asString(data.text);
    if (text) {
      parts.push(text);
    }
  }

  if (parts.length === 0) {
    return undefined;
  }

  return compactText(parts.join(' '), 220);
}

function summarizeFunctionOutput(value: unknown): string | undefined {
  const asText = asString(value);
  if (asText) {
    const parsed = parseJsonRecord(asText);
    if (parsed) {
      return summarizeFunctionOutputRecord(parsed) ?? compactText(asText, 220);
    }
    return summarizeLooseFunctionOutput(asText) ?? compactText(asText, 220);
  }

  const asObject = asRecord(value);
  if (asObject) {
    return summarizeFunctionOutputRecord(asObject);
  }

  return undefined;
}

function pickOutputPreview(rawValue: Record<string, unknown>): string | undefined {
  const body = asRecord(rawValue.body);
  const input = body?.input;

  if (!Array.isArray(input)) {
    return undefined;
  }

  const outputs: string[] = [];
  for (const itemValue of input) {
    const item = asRecord(itemValue);
    if (!item) {
      continue;
    }

    const type = asString(item.type);
    if (type && type !== 'function_call_output') {
      continue;
    }

    const summary = summarizeFunctionOutput(item.output);
    if (summary) {
      outputs.push(summary);
    }

    if (outputs.length >= 3) {
      break;
    }
  }

  if (outputs.length === 0) {
    return undefined;
  }

  return compactText(outputs.join(' | '), 420);
}

function pickTextPreview(rawValue: Record<string, unknown>): string | undefined {
  const payload = asRecord(rawValue.payload);
  const result = asRecord(rawValue.result);
  const progress = asRecord(rawValue.progress);

  const candidate =
    asString(rawValue.text) ??
    asString(result?.text) ??
    asString(payload?.content) ??
    asString(payload?.text) ??
    pickBodyOutputText(rawValue) ??
    asString(progress?.message);

  if (!candidate) {
    return undefined;
  }

  return compactText(candidate, 280);
}

function extractDerived(rawValue: Record<string, unknown>): EventDerived | undefined {
  const payload = asRecord(rawValue.payload);
  const body = asRecord(rawValue.body);
  const progress = asRecord(rawValue.progress);

  return compactDerived({
    conversationId: asIdString(rawValue.conversationId) ?? asIdString(payload?.conversationId),
    eventType: asString(rawValue.eventType) ?? asString(payload?.type),
    decision: asString(rawValue.decision),
    resultType: asString(rawValue.resultType),
    tool: asString(rawValue.tool),
    success: asBoolean(rawValue.success),
    attempt: asNumber(rawValue.attempt),
    maxAttempts: asNumber(rawValue.maxAttempts),
    statusCode: asNumber(rawValue.status),
    ok: asBoolean(rawValue.ok),
    model: asString(body?.model),
    progressType: asString(progress?.type),
    progressState: asString(progress?.state),
    progressMessage: asString(progress?.message),
    elapsedMs: asNumber(progress?.elapsedMs),
    step: asNumber(progress?.step),
    textPreview: pickTextPreview(rawValue),
    outputPreview: pickOutputPreview(rawValue)
  });
}

export function normalizeEvent(rawValue: unknown, context: NormalizeContext): NormalizedEvent | null {
  if (!isRecord(rawValue)) {
    return null;
  }

  const payload = asRecord(rawValue.payload);
  const traceRaw = asRecord(rawValue.trace);

  const timestamp = normalizeTimestamp(asString(rawValue.timestamp) ?? asString(payload?.timestamp), context.ingestedAt);
  const eventName = asString(rawValue.event) ?? 'unknown.event';

  const trace = traceRaw
    ? {
        traceId: asString(traceRaw.traceId),
        spanId: asString(traceRaw.spanId),
        parentSpanId:
          traceRaw.parentSpanId === null || typeof traceRaw.parentSpanId === 'string'
            ? (traceRaw.parentSpanId as string | null)
            : undefined,
        origin: asString(traceRaw.origin)
      }
    : undefined;

  const normalized: NormalizedEvent = {
    id: context.id,
    seq: context.seq,
    sourceId: context.sourceId,
    sourceLabel: context.sourceLabel,
    line: context.line,
    offset: context.offset,
    ingestedAt: context.ingestedAt,
    timestamp,
    event: eventName,
    stage: asString(rawValue.stage),
    chatId: asIdString(rawValue.chatId) ?? asIdString(payload?.chatId),
    messageId: asIdString(rawValue.messageId) ?? asIdString(payload?.messageId) ?? asIdString(payload?.telegramMessageId),
    senderId: asIdString(rawValue.senderId) ?? asIdString(payload?.senderId),
    trace,
    derived: extractDerived(rawValue),
    raw: rawValue
  };

  return normalized;
}

export function toSearchText(event: NormalizedEvent): string {
  return JSON.stringify(event.raw).toLowerCase();
}
