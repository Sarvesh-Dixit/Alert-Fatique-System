import assert from "node:assert";
import test from "node:test";
import { Monitor } from "../dist/index.js";

test("delivers batched events", async () => {
  const received = [];
  globalThis.fetch = async (_url, opts) => {
    received.push(JSON.parse(opts.body));
    return { ok: true, status: 202 };
  };

  const m = new Monitor({ apiKey: "th_test", endpoint: "http://x", batchSize: 2 });
  m.info("one");
  m.error("two");
  await m.close();

  const events = received.flatMap((b) => b.events);
  assert.strictEqual(events.length, 2);
});

test("never throws when platform is down", async () => {
  globalThis.fetch = async () => {
    throw new Error("ECONNREFUSED");
  };

  const m = new Monitor({
    apiKey: "th_test",
    endpoint: "http://localhost:59999",
    batchSize: 1,
    maxRetries: 1,
  });
  m.info("still running");
  await m.close(); // must resolve without throwing
  assert.ok(true);
});

test("buffer stays bounded", () => {
  globalThis.fetch = async () => ({ ok: true, status: 202 });
  const m = new Monitor({ apiKey: "th_test", maxBuffer: 5, batchSize: 1000, flushIntervalMs: 999999 });
  for (let i = 0; i < 50; i++) m.info(`e${i}`);
  // @ts-ignore private access for test
  assert.ok(m.buffer.length <= 5);
});
