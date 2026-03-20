import type { NormalizedEvent } from '@tracegraph/shared';

export const defaultClientEventCap = 100_000;

function getSeqAt(id: string, byId: Map<string, NormalizedEvent>): number {
  return byId.get(id)?.seq ?? Number.POSITIVE_INFINITY;
}

export class IncrementalEventIndex {
  private readonly byId = new Map<string, NormalizedEvent>();
  private readonly orderedIds: string[] = [];

  constructor(private readonly cap = defaultClientEventCap) {}

  clear(): void {
    this.byId.clear();
    this.orderedIds.length = 0;
  }

  replace(items: NormalizedEvent[]): void {
    this.clear();
    this.merge(items);
  }

  merge(items: NormalizedEvent[]): void {
    for (const item of items) {
      this.upsert(item);
    }
  }

  upsert(item: NormalizedEvent): void {
    const previous = this.byId.get(item.id);

    if (!previous) {
      const insertAt = this.findInsertIndex(item.seq);
      this.orderedIds.splice(insertAt, 0, item.id);
      this.byId.set(item.id, item);
      this.trimToCap();
      return;
    }

    if (previous.seq !== item.seq) {
      const previousIndex = this.orderedIds.indexOf(item.id);
      if (previousIndex >= 0) {
        this.orderedIds.splice(previousIndex, 1);
      }

      this.byId.set(item.id, item);
      const insertAt = this.findInsertIndex(item.seq);
      this.orderedIds.splice(insertAt, 0, item.id);
      this.trimToCap();
      return;
    }

    this.byId.set(item.id, item);
  }

  toArray(): NormalizedEvent[] {
    return this.orderedIds.map((id) => this.byId.get(id)).filter((event): event is NormalizedEvent => Boolean(event));
  }

  private trimToCap(): void {
    while (this.orderedIds.length > this.cap) {
      const removedId = this.orderedIds.shift();
      if (removedId) {
        this.byId.delete(removedId);
      }
    }
  }

  private findInsertIndex(seq: number): number {
    let low = 0;
    let high = this.orderedIds.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const midSeq = getSeqAt(this.orderedIds[mid] ?? '', this.byId);

      if (midSeq < seq) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }
}
