import path from 'node:path';
import os from 'node:os';
import { access, readFile } from 'node:fs/promises';
import YAML from 'yaml';
import type { SourceConfig } from '@tracegraph/shared';

export interface TracegraphConfig {
  server: {
    host: string;
    port: number;
  };
  sources: Array<SourceConfig & { resolvedPath: string }>;
}

interface RawConfig {
  server?: {
    host?: string;
    port?: number;
  };
  sources?: SourceConfig[];
}

export async function loadConfig(configPath?: string): Promise<TracegraphConfig> {
  const resolvedConfigPath = await resolveConfigPath(configPath ?? process.env.TRACEGRAPH_CONFIG);
  const rawContent = await readFile(resolvedConfigPath, 'utf8');
  const parsed = YAML.parse(rawContent) as RawConfig;
  const configDir = path.dirname(resolvedConfigPath);

  const host = parsed.server?.host ?? '0.0.0.0';
  const port = Number(parsed.server?.port ?? 4317);

  if (!Array.isArray(parsed.sources) || parsed.sources.length === 0) {
    throw new Error(`No sources configured in ${resolvedConfigPath}`);
  }

  const sources = await Promise.all(
    parsed.sources.map(async (source, index) => {
      if (!source?.id || !source?.label || !source?.path) {
        throw new Error(`Invalid source at index ${index} in ${resolvedConfigPath}`);
      }

      const resolvedPath = resolveInputPath(source.path, configDir);
      await access(path.dirname(resolvedPath));

      return {
        ...source,
        resolvedPath
      };
    })
  );

  return {
    server: { host, port },
    sources
  };
}

async function resolveConfigPath(configPath?: string): Promise<string> {
  if (configPath) {
    return resolveInputPath(configPath, process.cwd());
  }

  const candidates = [
    path.resolve(process.cwd(), 'tracegraph.config.yaml'),
    path.resolve(process.cwd(), '..', 'tracegraph.config.yaml'),
    path.resolve(process.cwd(), '..', '..', 'tracegraph.config.yaml')
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }

  throw new Error(
    `Could not find tracegraph.config.yaml. Looked in: ${candidates.join(', ')}. Set TRACEGRAPH_CONFIG to override.`
  );
}

function resolveInputPath(inputPath: string, baseDir: string): string {
  if (inputPath === '~') {
    return os.homedir();
  }

  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }

  return path.resolve(baseDir, inputPath);
}
