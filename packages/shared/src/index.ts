export interface TraceContext {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string | null;
  origin?: string;
}

export interface EventDerived {
  conversationId?: string;
  eventType?: string;
  decision?: string;
  resultType?: string;
  tool?: string;
  success?: boolean;
  attempt?: number;
  maxAttempts?: number;
  statusCode?: number;
  ok?: boolean;
  model?: string;
  progressType?: string;
  progressState?: string;
  progressMessage?: string;
  elapsedMs?: number;
  step?: number;
  textPreview?: string;
  outputPreview?: string;
}

export interface NormalizedEvent {
  id: string;
  seq: number;
  sourceId: string;
  sourceLabel: string;
  line: number;
  offset: number;
  ingestedAt: string;
  timestamp: string;
  event: string;
  stage?: string;
  chatId?: string;
  messageId?: string;
  senderId?: string;
  trace?: TraceContext;
  derived?: EventDerived;
  raw: Record<string, unknown>;
}

export interface EventFilterQuery {
  cursor?: string;
  limit?: number;
}

export interface EventListResponse {
  items: NormalizedEvent[];
  nextCursor: string | null;
  total: number;
  dropped: number;
}

export interface EventDetailResponse {
  item: NormalizedEvent | null;
}

export interface SourceConfig {
  id: string;
  label: string;
  path: string;
  color?: string;
}

export interface SourceStatus {
  sourceId: string;
  healthy: boolean;
  watching: boolean;
  lastReadAt: string | null;
  malformedLines: number;
  totalLines: number;
  error?: string;
}

export type SseEnvelope =
  | {
      type: 'snapshot';
      payload: {
        items: NormalizedEvent[];
        total: number;
        dropped: number;
        sources: SourceStatus[];
      };
    }
  | {
      type: 'append';
      payload: NormalizedEvent;
    }
  | {
      type: 'source_status';
      payload: SourceStatus;
    };
