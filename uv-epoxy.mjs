// Ultraviolet's transport: Epoxy (the same one Scramjet uses, over wisp),
// adapted for bare-mux. The installed Epoxy takes and returns headers as
// [name, value] lists; bare-mux (which Ultraviolet uses) works with plain
// header objects. Loaded by bare-mux's shared worker (proxy.js setTransport).
import EpoxyTransport from "/epoxy/index.mjs";

function toList(headers) {
  const out = [];
  if (!headers) return out;
  if (Array.isArray(headers)) return headers;
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) for (const v of value) out.push([name, String(v)]);
    else if (value != null) out.push([name, String(value)]);
  }
  return out;
}

function toObject(headers) {
  if (!headers || !Array.isArray(headers)) return headers || {};
  const out = {};
  for (const [name, value] of headers) {
    const key = name.toLowerCase();
    if (key in out) out[key] = [].concat(out[key], value);
    else out[key] = value;
  }
  return out;
}

export default class UVEpoxyTransport {
  constructor(options) {
    this.inner = new EpoxyTransport(options);
  }
  get ready() { return this.inner.ready; }
  set ready(v) { this.inner.ready = v; }
  init() { return this.inner.init(); }
  meta() { return {}; }
  async request(remote, method, body, headers, signal) {
    const res = await this.inner.request(remote, method, body, toList(headers), signal);
    return { ...res, headers: toObject(res.headers) };
  }
  connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
    return this.inner.connect(url, protocols, toList(requestHeaders), (protocol) => onopen(protocol), onmessage, onclose, onerror);
  }
}
