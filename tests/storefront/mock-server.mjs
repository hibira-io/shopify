// A small Pusher protocol 7 server for CI: public channels,
// pusher_internal:subscription_count (batched every 200 ms) and the HTTP
// events endpoint (signatures not checked). Local runs can point the
// end-to-end test at a real Hibira server instead (HIBIRA_E2E).
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

export async function startMockServer() {
  const subs = new Map(); // channel -> Set<socket>
  const dirty = new Set();
  let n = 0;

  const send = (ws, event, channel, data) =>
    ws.readyState === 1 &&
    ws.send(JSON.stringify({ event, ...(channel ? { channel } : {}), data: typeof data === "string" ? data : JSON.stringify(data) }));

  const http = createServer((req, res) => {
    const m = req.url.match(/^\/apps\/[^/]+\/events/);
    if (req.method !== "POST" || !m) {
      res.statusCode = 404;
      return res.end();
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const { name, data, channels = [], channel } = JSON.parse(body);
      for (const ch of channel ? [channel] : channels) {
        for (const ws of subs.get(ch) || []) send(ws, name, ch, data);
      }
      res.setHeader("content-type", "application/json");
      res.end("{}");
    });
  });

  const wss = new WebSocketServer({ server: http, path: undefined });
  wss.on("connection", (ws) => {
    const mine = new Set();
    send(ws, "pusher:connection_established", null, { socket_id: `${++n}.${n}`, activity_timeout: 120 });
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.event === "pusher:ping") return send(ws, "pusher:pong", null, {});
      if (msg.event === "pusher:subscribe") {
        const ch = msg.data.channel;
        if (!subs.has(ch)) subs.set(ch, new Set());
        subs.get(ch).add(ws);
        mine.add(ch);
        dirty.add(ch);
        send(ws, "pusher_internal:subscription_succeeded", ch, {});
      }
    });
    ws.on("close", () => {
      for (const ch of mine) {
        subs.get(ch)?.delete(ws);
        dirty.add(ch);
      }
    });
  });

  const tick = setInterval(() => {
    for (const ch of dirty) {
      const set = subs.get(ch) || new Set();
      for (const ws of set) send(ws, "pusher_internal:subscription_count", ch, { subscription_count: set.size });
    }
    dirty.clear();
  }, 200);

  await new Promise((r) => http.listen(0, "127.0.0.1", r));
  return {
    host: `127.0.0.1:${http.address().port}`,
    close: () => {
      clearInterval(tick);
      wss.close();
      http.close();
    },
  };
}
