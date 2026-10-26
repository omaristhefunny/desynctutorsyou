// Runs the proxy's network transport (Epoxy: TLS + wisp, in WebAssembly) in a
// background worker. In the page it competed with the site being browsed:
// every byte of a video was decrypted on the same thread as the site's own
// scripts, so heavy sites (TikTok) froze and their videos crawled.
//
// Messages from the page (proxy.js, WorkerTransport):
//   {type:"init", wisp}                      -> {type:"ready"} | {type:"init-error", message}
//   {type:"request", id, remote, method, body, headers}
//       -> {type:"head", id, status, statusText, headers}
//          {type:"chunk", id, chunk}  (repeated, ArrayBuffer transferred)
//          {type:"end", id} | {type:"error", id, message}
//   {type:"abort", id}
//   {type:"ws", id, url, protocols, headers}
//       -> {type:"ws-open", id, protocol, extensions} / {type:"ws-message", id, data}
//          {type:"ws-close", id, code, reason} / {type:"ws-error", id, message}
//   {type:"ws-send", id, data} / {type:"ws-close", id, code, reason}
import EpoxyTransport from "/epoxy/index.mjs";

let transport = null;
const aborts = new Map();
const sockets = new Map();

async function sendBody(id, body) {
  if (body == null) return;
  if (typeof body === "string") body = new TextEncoder().encode(body).buffer;
  if (body instanceof Blob) body = await body.arrayBuffer();
  if (body instanceof ArrayBuffer) {
    postMessage({ type: "chunk", id, chunk: body }, [body]);
    return;
  }
  if (ArrayBuffer.isView(body)) {
    const copy = body.slice().buffer;
    postMessage({ type: "chunk", id, chunk: copy }, [copy]);
    return;
  }
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || !value.byteLength) continue;
    // Copy only when the chunk is a view into a bigger buffer.
    const buf = value.byteOffset === 0 && value.byteLength === value.buffer.byteLength
      ? value.buffer
      : value.slice().buffer;
    postMessage({ type: "chunk", id, chunk: buf }, [buf]);
  }
}

async function handleRequest(m) {
  const ctrl = new AbortController();
  aborts.set(m.id, ctrl);
  try {
    const res = await transport.request(new URL(m.remote), m.method, m.body ?? null, m.headers, ctrl.signal);
    postMessage({ type: "head", id: m.id, status: res.status, statusText: res.statusText, headers: res.headers });
    await sendBody(m.id, res.body);
    postMessage({ type: "end", id: m.id });
  } catch (e) {
    postMessage({ type: "error", id: m.id, message: String((e && e.message) || e) });
  } finally {
    aborts.delete(m.id);
  }
}

function handleSocket(m) {
  try {
    const [send, close] = transport.connect(
      new URL(m.url),
      m.protocols || [],
      m.headers || [],
      (protocol, extensions) => postMessage({ type: "ws-open", id: m.id, protocol, extensions }),
      (data) => postMessage({ type: "ws-message", id: m.id, data }),
      (code, reason) => { sockets.delete(m.id); postMessage({ type: "ws-close", id: m.id, code, reason }); },
      (message) => postMessage({ type: "ws-error", id: m.id, message: String(message) }),
    );
    sockets.set(m.id, { send, close });
  } catch (e) {
    postMessage({ type: "ws-error", id: m.id, message: String((e && e.message) || e) });
    postMessage({ type: "ws-close", id: m.id, code: 1006, reason: "" });
  }
}

onmessage = async (e) => {
  const m = e.data;
  switch (m.type) {
    case "init":
      try {
        transport = new EpoxyTransport({ wisp: m.wisp });
        await transport.init();
        postMessage({ type: "ready" });
      } catch (err) {
        postMessage({ type: "init-error", message: String((err && err.message) || err) });
      }
      break;
    case "request": handleRequest(m); break;
    case "abort": aborts.get(m.id)?.abort(); break;
    case "ws": handleSocket(m); break;
    case "ws-send": sockets.get(m.id)?.send(m.data); break;
    case "ws-close": sockets.get(m.id)?.close(m.code, m.reason); break;
  }
};
