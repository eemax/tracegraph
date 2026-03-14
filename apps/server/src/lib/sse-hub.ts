import type { SseEnvelope } from '@observe-graph/shared';

type Subscriber = (payload: SseEnvelope) => void;

export class SseHub {
  private readonly subscribers = new Set<Subscriber>();

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  publish(envelope: SseEnvelope): void {
    for (const subscriber of this.subscribers) {
      subscriber(envelope);
    }
  }
}
