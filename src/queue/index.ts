/**
 * Job queue using p-queue for controlled concurrency.
 */

import PQueue from "p-queue";
import type { Config } from "../analyzers/types.js";

export interface Job {
  filePath: string;
  addedAt: Date;
}

export function createQueue(config: Config): PQueue {
  return new PQueue({
    concurrency: config.concurrency,
  });
}

export async function enqueue(
  queue: PQueue,
  job: Job,
  handler: (job: Job) => Promise<void>,
): Promise<void> {
  await queue.add(() => handler(job));
}

export function getQueueStatus(queue: PQueue): {
  size: number;
  pending: number;
} {
  return {
    size: queue.size,
    pending: queue.pending,
  };
}
