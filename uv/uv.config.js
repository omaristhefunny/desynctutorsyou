/*global Ultraviolet*/
var __uvBase = (function () {
  try { if (typeof document !== "undefined" && document.currentScript && document.currentScript.src) return new URL("../", document.currentScript.src).pathname; } catch (e) {}
  try { return new URL("./", self.location.href).pathname; } catch (e) {}
  return "/";
})();
self.__uv$config = {
  prefix: __uvBase + "service/",
  bare: "/bare/",
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: __uvBase + "uv/uv.handler.js",
  client: __uvBase + "uv/uv.client.js",
  bundle: __uvBase + "uv/uv.bundle.js",
  config: __uvBase + "uv/uv.config.js",
  sw: __uvBase + "uv/uv.sw.js",
};
