import type { NormalizedEvent } from '@tracegraph/shared';
import { formatTimestamp } from '../ui';

export type ParsedField = { label: string; value: string };

const notAvailable = 'n/a';

function toDisplay(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return notAvailable;
  }

  return String(value);
}

export function buildParsedFields(event: NormalizedEvent): ParsedField[] {
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
