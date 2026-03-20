import { describe, expect, it } from 'vitest';
import { RequestVersion } from './request-version';

describe('RequestVersion', () => {
  it('marks only the latest issued version as current', () => {
    const version = new RequestVersion();

    const first = version.next();
    expect(version.isCurrent(first)).toBe(true);

    const second = version.next();
    expect(version.isCurrent(first)).toBe(false);
    expect(version.isCurrent(second)).toBe(true);
  });
});
