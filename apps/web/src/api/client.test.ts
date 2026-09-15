import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { streamAgentMessage } from "./client.js";

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]));
        i++;
      } else {
        controller.close();
      }
    },
  });
  return new Response(stream, { status: 200 });
}

describe("streamAgentMessage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses SSE events split across chunk boundaries, in order", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      sseResponse([
        'event: tool_call\ndata: {"tool":"query_fused_data"}\n\n',
        'event: to', // split mid-event-name across chunks
        'ken\ndata: {"text":"hello"}\n\n',
      ]),
    );

    const received: { event: string; data: unknown }[] = [];
    await streamAgentMessage("tok", "sess_1", "hi", (event, data) =>
      received.push({ event, data }),
    );

    expect(received).toEqual([
      { event: "tool_call", data: { tool: "query_fused_data" } },
      { event: "token", data: { text: "hello" } },
    ]);
  });

  it("throws ApiClientError when the response isn't ok", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(null, { status: 404 }),
    );
    await expect(streamAgentMessage("tok", "missing", "hi", () => {})).rejects.toThrow();
  });
});
