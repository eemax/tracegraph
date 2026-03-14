import path from 'node:path';

export const repoRoot = path.resolve(import.meta.dir, '..', '..');
export const configPath = path.join(repoRoot, 'observe-graph.config.yaml');
export const fixturesDir = path.join(repoRoot, 'tests', 'fixtures');
export const tmpDir = path.join(repoRoot, 'tests', 'tmp');
export const resultsDir = path.join(repoRoot, 'tests', 'results');
