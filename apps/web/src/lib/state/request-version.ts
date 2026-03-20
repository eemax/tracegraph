export class RequestVersion {
  private current = 0;

  next(): number {
    this.current += 1;
    return this.current;
  }

  isCurrent(version: number): boolean {
    return version === this.current;
  }
}
