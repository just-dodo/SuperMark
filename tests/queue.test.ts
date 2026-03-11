import { describe, it, expect } from "vitest";
import { createQueue, enqueue, getQueueStatus } from "../src/queue/index.js";
import type { Job } from "../src/queue/index.js";
import type { Config } from "../src/analyzers/types.js";

const baseConfig: Config = {
  watchDir: "./inbox",
  outputDir: "./digests",
  recursive: true,
  concurrency: 2,
  debounceMs: 1000,
  ignore: [],
  cleanupDigests: false,
  ai: { provider: "openai", model: "gpt-4o", whisperModel: "whisper-1" },
};

describe("createQueue", () => {
  it("creates queue with configured concurrency", () => {
    const queue = createQueue(baseConfig);
    expect(queue).toBeDefined();
    // p-queue exposes concurrency
    expect((queue as any).concurrency).toBe(2);
  });
});

describe("enqueue", () => {
  it("processes jobs through the handler", async () => {
    const queue = createQueue(baseConfig);
    const processed: string[] = [];

    const job: Job = { filePath: "/tmp/test.txt", addedAt: new Date() };

    await enqueue(queue, job, async (j) => {
      processed.push(j.filePath);
    });

    expect(processed).toContain("/tmp/test.txt");
  });

  it("processes multiple jobs", async () => {
    const queue = createQueue(baseConfig);
    const processed: string[] = [];

    const jobs: Job[] = [
      { filePath: "/tmp/a.txt", addedAt: new Date() },
      { filePath: "/tmp/b.txt", addedAt: new Date() },
      { filePath: "/tmp/c.txt", addedAt: new Date() },
    ];

    await Promise.all(
      jobs.map((job) =>
        enqueue(queue, job, async (j) => {
          processed.push(j.filePath);
        })
      )
    );

    await queue.onIdle();
    expect(processed).toHaveLength(3);
    expect(processed).toContain("/tmp/a.txt");
    expect(processed).toContain("/tmp/b.txt");
    expect(processed).toContain("/tmp/c.txt");
  });
});

describe("getQueueStatus", () => {
  it("reports correct queue status (size, pending)", async () => {
    const queue = createQueue({ ...baseConfig, concurrency: 1 });

    // Initially idle
    const initialStatus = getQueueStatus(queue);
    expect(initialStatus.size).toBe(0);
    expect(initialStatus.pending).toBe(0);

    // Add a slow job without awaiting
    let resolve!: () => void;
    const blocker = new Promise<void>((res) => { resolve = res; });

    const job: Job = { filePath: "/tmp/slow.txt", addedAt: new Date() };
    const p1 = enqueue(queue, job, async () => { await blocker; });
    const job2: Job = { filePath: "/tmp/queued.txt", addedAt: new Date() };
    const p2 = enqueue(queue, job2, async () => {});

    // Give p-queue a tick to start processing
    await new Promise((r) => setTimeout(r, 0));

    const status = getQueueStatus(queue);
    // One job is pending (running), one is queued
    expect(status.pending).toBe(1);
    expect(status.size).toBe(1);

    resolve();
    await Promise.all([p1, p2]);
  });
});
