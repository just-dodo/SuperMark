/**
 * File watcher using chokidar — monitors a directory for new/changed files.
 */

import chokidar, { type FSWatcher } from "chokidar";
import type { Config } from "../analyzers/types.js";

export interface WatcherEvents {
  onFileAdded: (filePath: string) => void;
  onFileChanged?: (filePath: string) => void;
  onFileRemoved?: (filePath: string) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export function startWatcher(
  config: Config,
  events: WatcherEvents,
): FSWatcher {
  const watcher = chokidar.watch(config.watchDir, {
    persistent: true,
    ignoreInitial: false,
    ignored: config.ignore,
    depth: config.recursive ? undefined : 0,
    awaitWriteFinish: {
      stabilityThreshold: config.debounceMs,
      pollInterval: 100,
    },
  });

  watcher.on("add", events.onFileAdded);

  if (events.onFileChanged) {
    watcher.on("change", events.onFileChanged);
  }

  if (events.onFileRemoved) {
    watcher.on("unlink", events.onFileRemoved);
  }

  if (events.onReady) {
    watcher.on("ready", events.onReady);
  }

  if (events.onError) {
    watcher.on("error", (err: unknown) => events.onError!(err instanceof Error ? err : new Error(String(err))));
  }

  return watcher;
}

export function stopWatcher(watcher: FSWatcher): Promise<void> {
  return watcher.close();
}
