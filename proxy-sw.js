// ---- jsDelivr: serve this site's pages as HTML -----------------------------
// jsDelivr marks .html files as text/plain. Page loads inside this worker's
// scope are answered with the same file marked as HTML (see build-jsd.mjs).
(function () {
  var BASE = new URL("./", self.location).href;
  var BASE_PATH = new URL(BASE).pathname;
  var PAGES = new Set(["404.html","account.html","calculus.html","chat.html","embed-wrapper.html","embed.html","gnmath.html","hangman.html","history.html","index.html","main.html","movies.html","music.html","other/dmca.html","other/partners.html","other/privacy.html","science.html","settings.html","spanish.html","studying.html"]);
  var ROUTES = new Set(["404","account","ai","apps","c","calculus","chat","dmca","g","games","gnmath","hangman","more-games","movies","music","p","partners","privacy","s","settings","studying"]);

  function pageFile(url) {
    var u = new URL(url);
    if (u.origin !== self.location.origin || u.pathname.indexOf(BASE_PATH) !== 0) return null;
    var rel = u.pathname.slice(BASE_PATH.length);
    try { rel = decodeURIComponent(rel); } catch (e) {}
    // The frame in index.svg is the home shell, so the site root is the home page.
    if (rel === "" || rel === "index.html") return BASE + "main.html";
    if (PAGES.has(rel)) return BASE + encodeURI(rel);
    var route = rel.replace(/\/$/, "");
    if (ROUTES.has(route)) return BASE + "_routes/" + encodeURIComponent(route) + ".html";
    return null;
  }

  self.addEventListener("fetch", function (event) {
    var req = event.request;
    if (req.method !== "GET") return;
    if (req.mode !== "navigate" && req.destination !== "document" && req.destination !== "iframe") return;
    var file = pageFile(req.url);
    if (!file) return;
    event.respondWith(
      fetch(file, { cache: "no-cache" }).then(function (res) {
        if (!res.ok) return res;
        return new Response(res.body, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      })
    );
  });
})();

// Scramjet only (Ultraviolet was removed; its traffic exposed the server's IP).
importScripts("controller/controller.sw.js");

// ---- ad blocker ------------------------------------------------------------
// Requests made by sites viewed THROUGH the proxy are checked against a list of
// ad/tracker domains (adblock/domains.txt, from StevenBlack/hosts) and answered
// with an empty response. Desync's own pages and ads are never touched: only
// proxied (Scramjet-prefixed) requests are checked, and page navigations
// always go through so a site never fails to open.
// Relative to this worker, so it also works when the site lives in a folder (S3).
const ADBLOCK_LIST = new URL("adblock/domains.txt", self.location).href;
const ADBLOCK_CACHE = "desync-adblock-v1";
// Small built-in list so blocking works before the full list has loaded.
let adDomains = new Set([
  "doubleclick.net", "googlesyndication.com", "googleadservices.com", "adservice.google.com",
  "pagead2.googlesyndication.com", "securepubads.g.doubleclick.net", "adnxs.com", "taboola.com",
  "outbrain.com", "criteo.com", "pubmatic.com", "rubiconproject.com", "openx.net", "amazon-adsystem.com",
  "adsrvr.org", "moatads.com", "popads.net", "propellerads.com", "exoclick.com", "scorecardresearch.com",
]);
let adListLoading = null;

function loadAdList() {
  if (adListLoading) return adListLoading;
  adListLoading = (async () => {
    try {
      const cache = await caches.open(ADBLOCK_CACHE);
      let res = await cache.match(ADBLOCK_LIST);
      if (!res) {
        res = await fetch(ADBLOCK_LIST, { cache: "no-cache" });
        if (!res.ok) throw new Error("list " + res.status);
        await cache.put(ADBLOCK_LIST, res.clone());
      }
      const list = (await res.text()).split("\n").filter(Boolean);
      adDomains = new Set([...adDomains, ...list]);
    } catch (e) {
      adListLoading = null; // try again later
    }
  })();
  return adListLoading;
}

function isAdHost(host) {
  host = host.toLowerCase();
  // Check the host and each parent domain (a.b.ads.com -> b.ads.com -> ads.com).
  for (let h = host; h.includes("."); h = h.slice(h.indexOf(".") + 1)) {
    if (adDomains.has(h)) return true;
  }
  return false;
}

// The real destination of a proxied request, or null if it isn't proxied.
function proxiedTarget(request) {
  try {
    const url = new URL(request.url);
    if (url.pathname.includes("/~/sj/")) {
      const m = /(https?:\/\/[^\s]+)/i.exec(decodeURIComponent(url.pathname.slice(url.pathname.indexOf("/~/sj/"))));
      if (m) return new URL(m[1]);
    }
  } catch (e) {}
  return null;
}

const TRANSPARENT_GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));

function blockedResponse(request) {
  const d = request.destination;
  if (d === "image") return new Response(TRANSPARENT_GIF, { headers: { "Content-Type": "image/gif" } });
  if (d === "script") return new Response("", { headers: { "Content-Type": "text/javascript" } });
  if (d === "style") return new Response("", { headers: { "Content-Type": "text/css" } });
  return new Response("", { status: 200, headers: { "Content-Type": "text/plain" } });
}

function shouldBlock(event) {
  if (event.request.mode === "navigate") return false;
  const target = proxiedTarget(event.request);
  return Boolean(target && isAdHost(target.hostname));
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(loadAdList());
});
self.addEventListener("activate", (event) => event.waitUntil(Promise.all([self.clients.claim(), loadAdList()])));

self.addEventListener("fetch", (event) => {
  loadAdList();
  if ($scramjetController.shouldRoute(event)) {
    if (shouldBlock(event)) return event.respondWith(blockedResponse(event.request));
    event.respondWith($scramjetController.route(event));
  }
});
