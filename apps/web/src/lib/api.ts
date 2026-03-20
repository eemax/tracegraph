import type { EventListResponse, SseEnvelope } from '@tracegraph/shared';
import { buildQueryString, type UiFilters } from '$lib/ui';

function toErrorMessage(response: Response, detail?: string): string {
  const base = `Request failed with status ${response.status}`;
  return detail ? `${base}: ${detail}` : base;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail: string | undefined;

    try {
      const payload = (await response.json()) as { error?: string };
      if (typeof payload.error === 'string') {
        detail = payload.error;
      }
    } catch {
      // Ignore non-JSON failures and surface status code fallback.
    }

    throw new Error(toErrorMessage(response, detail));
  }

  return (await response.json()) as T;
}

export async function fetchEvents(filters: UiFilters, cursor?: string | null, limit = 300): Promise<EventListResponse> {
  const query = buildQueryString(filters, cursor, limit);
  const response = await fetch(`/api/events?${query}`);
  return parseJsonResponse<EventListResponse>(response);
}

export async function fetchTraceEvents(filters: UiFilters, traceId: string, limit = 500): Promise<EventListResponse> {
  const query = buildQueryString(filters, null, limit, { traceId });
  const response = await fetch(`/api/events?${query}`);
  return parseJsonResponse<EventListResponse>(response);
}

interface EventStreamHandlers {
  onEnvelope: (envelope: SseEnvelope) => void;
  onParseError?: (error: unknown, raw: string) => void;
  onOpen?: () => void;
  onError?: () => void;
}

export function connectEventStream(handlers: EventStreamHandlers): EventSource {
  const stream = new EventSource('/api/stream');

  stream.onopen = () => {
    handlers.onOpen?.();
  };

  stream.onmessage = (event) => {
    try {
      const envelope = JSON.parse(event.data) as SseEnvelope;
      handlers.onEnvelope(envelope);
    } catch (error) {
      handlers.onParseError?.(error, event.data);
    }
  };

  stream.onerror = () => {
    handlers.onError?.();
  };

  return stream;
}
