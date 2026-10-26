"use strict";

const STORAGE_KEY = 'embed_destination';

let swReady = false;
OnlyProxy.ready.then(() => { swReady = true; }).catch(() => {});

let forcedEngine = null;
try {
  const e = new URLSearchParams(location.search).get('engine');
  if (e === 'scramjet') forcedEngine = e;
} catch (e) {}

let proxyFailed = false;

function showProxyError(err) {
  proxyFailed = true;
  const detail = String((err && err.message) || err || 'unknown error');
  const insecure = !window.isSecureContext;
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('is-error');
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
  }
  const h1 = document.getElementById('theh1');
  const p = document.getElementById('thep');
  if (h1) h1.innerText = "Can't start the proxy";
  if (p) {
    p.innerText = insecure
      ? 'Service workers need a secure context. Open the site over http://localhost or HTTPS with a trusted certificate.'
      : 'The proxy failed to start: ' + detail +
        (location.protocol === 'https:'
          ? ' If this is a self-signed certificate, the browser will refuse to register the service worker.'
          : '');
  }
  console.error('[proxy] failed to start:', detail);
}

function navWindow() {
  try {
    if (window === window.top) return window;
    let w = window;
    for (let i = 0; i < 10 && w.parent !== window.top; i++) w = w.parent;
    return w;
  } catch (e) {
    return window;
  }
}

function goTo(href) {
  navWindow().location.href = href;
}

function frameHistoryGo(delta) {
  const iframe = activeFrame();
  if (!iframe) return;
  try {
    iframe.contentWindow.history.go(delta);
  } catch (e) {
    console.warn('[embed] cannot move through the frame history:', e);
  }
}

let currentDestination = null;

function setScheme(state) {
  const el = document.getElementById('url-scheme');
  if (!el) return;
  el.dataset.state = state;
  el.title =
    state === 'secure' ? 'Encrypted between the proxy and this site'
    : state === 'insecure' ? 'Not encrypted between the proxy and this site'
    : '';
}

function paintDisplay(url) {
  const display = document.getElementById('url-display');
  if (!display) return;

  if (!url) {
    display.innerHTML = '';
    const ph = document.createElement('span');
    ph.className = 'u-placeholder';
    ph.textContent = 'Search or enter a URL';
    display.appendChild(ph);
    setScheme('blank');
    return;
  }

  let origin = url, rest = '';
  try {
    const u = new URL(url);
    origin = u.host;
    rest = u.pathname === '/' ? '' : u.pathname;
    if (u.search) rest += u.search;
    setScheme(u.protocol === 'https:' ? 'secure' : 'insecure');
  } catch (e) {
    setScheme('blank');
  }

  display.innerHTML = '';
  const o = document.createElement('span');
  o.className = 'u-origin';
  o.textContent = origin;
  display.appendChild(o);
  if (rest) {
    const r = document.createElement('span');
    r.className = 'u-path';
    r.textContent = rest;
    display.appendChild(r);
  }
  display.title = url;
}

function isEditing() {
  const omni = document.getElementById('omnibox');
  return Boolean(omni) && omni.classList.contains('editing');
}

function setEditing(on) {
  const omni = document.getElementById('omnibox');
  const input = document.getElementById('browser-url');
  if (!omni || !input) return;
  omni.classList.toggle('editing', on);
  if (on) {
    input.value = currentDestination || '';
    input.focus();
    input.select();
  } else {
    input.blur();
  }
}

function paintEngineChip() {
  // Scramjet is the only engine; its traffic leaves through a VPN.
  const chip = document.getElementById('engine-chip');
  if (!chip) return;
  chip.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>VPN';
  chip.classList.remove('is-auto');
  chip.title = 'Scramjet proxy. Sites see a VPN address, not yours.';
}

function announceDestination() {
  paintEngineChip();
  document.dispatchEvent(new CustomEvent('proxy:destination', { detail: { url: currentDestination } }));
}

function updateUrlDisplay(url) {
  const urlInput = document.getElementById('browser-url');

  if (!url || url.startsWith('about:') || url === 'about:blank') {
    currentDestination = null;
    if (urlInput) urlInput.value = '';
    paintDisplay(null);
    announceDestination();
    return;
  }

  let shown = url;
  const decoded = OnlyProxy.decodeUrl(url);
  if (decoded) shown = decoded;

  currentDestination = shown;
  if (urlInput && !isEditing()) urlInput.value = shown;
  paintDisplay(shown);
  announceDestination();
}

let progressTimer = null;
let progressTab = null;

function startProgress() {
  const bar = document.getElementById('proxy-progress');
  if (!bar) return;
  clearInterval(progressTimer);
  let at = 0;
  bar.classList.add('active');
  bar.style.width = '0%';
  progressTimer = setInterval(() => {
    at += Math.max(0.4, (92 - at) * 0.06);
    bar.style.width = Math.min(at, 92) + '%';
  }, 120);
}

function finishProgress() {
  const bar = document.getElementById('proxy-progress');
  if (!bar) return;
  clearInterval(progressTimer);
  progressTimer = null;
  bar.style.width = '100%';
  setTimeout(() => {
    bar.classList.remove('active');
    setTimeout(() => { if (!progressTimer) bar.style.width = '0%'; }, 260);
  }, 180);
}

function clearProgress() {
  const bar = document.getElementById('proxy-progress');
  if (!bar) return;
  clearInterval(progressTimer);
  progressTimer = null;
  bar.classList.remove('active');
  bar.style.width = '0%';
}

function showLoading() {
  const overlay = document.getElementById('loading-overlay');
  const theh1 = document.getElementById('theh1');
  const thep = document.getElementById('thep');

  if (overlay) {
    overlay.classList.remove('is-error');
    overlay.style.display = 'flex';
    void overlay.offsetWidth;
    overlay.style.opacity = '1';
  }
  if (theh1) theh1.textContent = 'Loading';
  if (thep) thep.textContent = 'Please Wait';
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  const fadeout = document.getElementById('fadeout');

  if (overlay) overlay.style.opacity = '0';
  if (fadeout) fadeout.style.opacity = '0';

  setTimeout(() => {
    if (overlay && overlay.style.opacity === '0') overlay.style.display = 'none';
    if (fadeout) fadeout.style.display = 'none';
  }, 600);
}

function refreshNavState(iframe) {
  const back = document.getElementById('back-btn');
  if (!back) return;
  let canGoBack = false;
  try { canGoBack = iframe.contentWindow.history.length > 1; } catch (e) { canGoBack = true; }
  back.setAttribute('aria-disabled', String(!canGoBack));
}

const TABS_KEY = 'embed_tabs';

let tabs = [];
let activeTab = null;
let tabSeq = 0;
let frameAttrs = [];

function hasTabStrip() {
  return Boolean(document.getElementById('tab-list'));
}

function activeFrame() {
  return activeTab ? activeTab.iframe : document.getElementById('proxy-iframe');
}

function hostOf(url) {
  try { return new URL(url).host.replace(/^www\./, ''); } catch (e) { return url || ''; }
}

function newFrame() {
  const f = document.createElement('iframe');
  for (const [name, value] of frameAttrs) f.setAttribute(name, value);
  f.className = 'proxy-iframe';
  document.body.insertBefore(f, document.getElementById('empty-state'));
  return f;
}

function makeTab(iframe, url) {
  const tab = {
    id: ++tabSeq, iframe, url: null, title: '',
    loading: false, loadedOnce: false, failsafe: null, pending: null,
  };
  if (url) { tab.url = url; tab.pending = url; tab.title = hostOf(url); }
  iframe.addEventListener('load', () => onFrameLoad(tab));
  tabs.push(tab);
  return tab;
}

function loadInTab(tab, destination) {
  tab.url = destination;
  tab.pending = null;
  tab.title = hostOf(destination);
  tab.loading = true;
  tab.iframe.classList.add('is-loading');
  if (tab === activeTab) {
    syncStage();
    try { sessionStorage.setItem(STORAGE_KEY, destination); } catch (e) {}
  }
  renderTabs();

  const go = () => {
    const proxyUrl = OnlyProxy.encodeUrl(destination, forcedEngine, tab.iframe);
    if (!proxyUrl) throw new Error('the selected proxy backend is not ready');
    clearTimeout(tab.failsafe);
    tab.iframe.src = proxyUrl;
    tab.failsafe = setTimeout(() => { if (tab.loading) finishTabLoad(tab); }, 8000);
  };
  if (swReady) {
    try { go(); } catch (e) { showProxyError(e); }
  } else {
    OnlyProxy.ready.then(go).catch(showProxyError);
  }
}

function finishTabLoad(tab) {
  clearTimeout(tab.failsafe);
  tab.iframe.classList.remove('is-loading');
  tab.loading = false;
  tab.loadedOnce = true;
  if (tab === activeTab) syncStage();
  renderTabs();
}

function readTitle(tab) {
  try {
    const t = tab.iframe.contentDocument.title.trim();
    if (t) return t.slice(0, 120);
  } catch (e) {}
  return '';
}

function rerouteIfNeeded(tab, href, decoded) {
  if (forcedEngine || !decoded || OnlyProxy.getPreference() !== 'auto') return false;
  const served = OnlyProxy.engineOf(href);
  const wanted = OnlyProxy.getBackend(decoded);
  if (!served || served === wanted) return false;

  const now = Date.now();
  tab.reroutes = (tab.reroutes || []).filter((t) => now - t < 15000);
  if (tab.reroutes.length >= 3) {
    console.warn('[embed] not switching engines again for', decoded);
    return false;
  }
  tab.reroutes.push(now);
  loadInTab(tab, decoded);
  if (tab === activeTab) updateUrlDisplay(decoded);
  return true;
}

function onFrameLoad(tab) {
  let href = '';
  try { href = tab.iframe.contentWindow.location.href; } catch (e) {}
  if (!href || href.startsWith('about:')) return;

  const early = OnlyProxy.decodeUrl(href);
  if (rerouteIfNeeded(tab, href, early)) return;

  try {
    tab.iframe.contentWindow.addEventListener('pagehide', () => {
      tab.iframe.classList.add('is-loading');
    });
  } catch (e) {}

  setTimeout(() => {
    const decoded = OnlyProxy.decodeUrl(href);
    if (decoded) tab.url = decoded;
    tab.title = readTitle(tab) || hostOf(tab.url);
    finishTabLoad(tab);
    if (tab === activeTab) {
      updateUrlDisplay(href);
      refreshNavState(tab.iframe);
      paintEngineChip();
      document.dispatchEvent(new CustomEvent('proxy:loaded'));
      syncHash();
    }
    saveTabs();
  }, 200);
}

function syncStage() {
  const tab = activeTab;
  const emptyState = document.getElementById('empty-state');
  const hasBar = Boolean(document.getElementById('proxy-progress'));
  const isEmpty = !tab || (!tab.url && !tab.loading);

  if (emptyState) emptyState.style.display = isEmpty ? 'flex' : 'none';

  if (proxyFailed) return;

  const curtain = tab && tab.loading && (!tab.loadedOnce || !hasBar);
  if (curtain) showLoading();
  else hideLoading();

  if (tab && tab.loading) {
    if (progressTab !== tab) startProgress();
    progressTab = tab;
  } else if (progressTab) {
    if (progressTab === tab) finishProgress();
    else clearProgress();
    progressTab = null;
  }
}

function switchTab(tab) {
  if (!tab || tab === activeTab) return;
  activeTab = tab;
  for (const t of tabs) t.iframe.classList.toggle('is-bg', t !== tab);

  if (isEditing()) setEditing(false);
  updateUrlDisplay(tab.url);
  refreshNavState(tab.iframe);
  if (tab.pending) loadInTab(tab, tab.pending);

  syncStage();
  renderTabs();
  syncHash();
  saveTabs();
}

function openTab(url, background) {
  const tab = makeTab(newFrame());
  tab.iframe.classList.add('is-bg');
  if (url) {
    if (background) loadInTab(tab, url);
    else tab.pending = url;
    tab.url = url;
    tab.title = hostOf(url);
  }
  if (!background) switchTab(tab);
  renderTabs();
  saveTabs();
  if (!url && !background) setEditing(true);
  return tab;
}

function closeTab(tab) {
  const i = tabs.indexOf(tab);
  if (i < 0) return;
  if (tabs.length === 1) openTab(null);

  clearTimeout(tab.failsafe);
  tabs.splice(tabs.indexOf(tab), 1);
  if (OnlyProxy.releaseFrame) OnlyProxy.releaseFrame(tab.iframe);
  tab.iframe.remove();

  if (activeTab === tab) {
    activeTab = null;
    switchTab(tabs[Math.min(i, tabs.length - 1)]);
  }
  renderTabs();
  saveTabs();
}

function syncHash() {
  if (!hasTabStrip()) return;
  const url = activeTab && activeTab.url;
  const next = url ? '#' + encodeURIComponent(url) : location.pathname + location.search;
  if (location.hash !== (url ? '#' + encodeURIComponent(url) : '')) history.replaceState(null, '', next);
}

function saveTabs() {
  if (!hasTabStrip()) return;
  try {
    sessionStorage.setItem(TABS_KEY, JSON.stringify({
      tabs: tabs.map((t) => t.url || null),
      active: Math.max(0, tabs.indexOf(activeTab)),
    }));
    if (activeTab && activeTab.url) sessionStorage.setItem(STORAGE_KEY, activeTab.url);
  } catch (e) {}
}

function loadSavedTabs() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TABS_KEY) || 'null');
    if (saved && Array.isArray(saved.tabs) && saved.tabs.length) return saved;
  } catch (e) {}
  return null;
}

function tabIcon(tab) {
  if (tab.loading) {
    const s = document.createElement('span');
    s.className = 'tab-spinner';
    s.setAttribute('aria-hidden', 'true');
    return s;
  }
  if (tab.url && window.ProxyIcon) return window.ProxyIcon(tab.url);
  return null;
}

function renderTabs() {
  const list = document.getElementById('tab-list');
  if (!list) return;
  list.innerHTML = '';

  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = 'tab';
    el.setAttribute('role', 'tab');
    el.setAttribute('aria-selected', String(tab === activeTab));
    el.tabIndex = tab === activeTab ? 0 : -1;
    el.title = tab.url ? (tab.title && tab.title !== hostOf(tab.url) ? tab.title + '\n' : '') + tab.url : 'New tab';
    if (tab === activeTab) el.classList.add('is-active');

    const icon = tabIcon(tab);
    if (icon) el.appendChild(icon);
    const label = document.createElement('span');
    label.className = 'tab-title';
    label.textContent = tab.url ? (tab.title || hostOf(tab.url)) : 'New tab';
    el.appendChild(label);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'tab-close';
    close.tabIndex = -1;
    close.title = 'Close tab';
    close.setAttribute('aria-label', 'Close ' + label.textContent);
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    close.addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab); });
    el.appendChild(close);

    el.addEventListener('click', () => switchTab(tab));
    el.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
    el.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); closeTab(tab); } });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const next = tabs[(tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        switchTab(next);
        const n = list.children[tabs.indexOf(next)];
        if (n) n.focus();
      } else if (e.key === 'Delete') {
        closeTab(tab);
      }
    });
    list.appendChild(el);
  }

  const active = list.querySelector('.tab.is-active');
  if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function watchTabs() {
  setInterval(() => {
    let changed = false;
    for (const tab of tabs) {
      if (!tab.loadedOnce || tab.loading) continue;
      const title = readTitle(tab);
      if (title && title !== tab.title) { tab.title = title; changed = true; }
      let href = '', decoded = '';
      try {
        href = tab.iframe.contentWindow.location.href;
        decoded = OnlyProxy.decodeUrl(href);
      } catch (e) {}
      if (decoded && decoded !== tab.url) {
        if (rerouteIfNeeded(tab, href, decoded)) { changed = true; continue; }
        tab.url = decoded;
        changed = true;
        if (tab === activeTab) {
          updateUrlDisplay(decoded);
          refreshNavState(tab.iframe);
          syncHash();
        }
      }
    }
    if (changed) { renderTabs(); saveTabs(); }
  }, 1500);
}

function navigateToUrl(url) {
  let destination = url.trim();
  
  if (!destination) return;
  
  if (!destination.startsWith('http://') && !destination.startsWith('https://')) {
    if (destination.includes('.') && !destination.includes(' ')) {
      destination = 'https://' + destination;
    } else {
      destination = 'https://duckduckgo.com/?kae=d&q=' + encodeURIComponent(destination);
    }
  }
  
  try {
    const validUrl = new URL(destination).toString();
    if (!activeTab) switchTab(makeTab(activeFrame()));
    updateUrlDisplay(validUrl);
    loadInTab(activeTab, validUrl);
    syncHash();
    saveTabs();
  } catch (err) {
    console.error('Invalid URL:', err);
    const theh1 = document.getElementById('theh1');
    const thep = document.getElementById('thep');
    if (theh1) theh1.innerText = "Invalid URL";
    if (thep) thep.innerText = "Please enter a valid website address";
  }
}

function toggleFullscreen() {
  const iframe = activeFrame();
  if (!iframe) return;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else if (iframe.requestFullscreen) {
    iframe.requestFullscreen().catch((e) => console.warn('[embed] fullscreen refused:', e));
  }
}

function setBarHidden(hidden) {
  document.body.classList.toggle('bar-hidden', hidden);
  const handle = document.getElementById('reveal-bar');
  if (handle) handle.setAttribute('aria-expanded', String(!hidden));
}

function hashDestination() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  try {
    return new URL(decodeURIComponent(hash)).toString();
  } catch (err) {
    console.error('Bad URL:', err);
    return false;
  }
}

function initEmbed() {
  const urlInput = document.getElementById('browser-url');
  const refreshBtn = document.getElementById('refresh-btn');
  const homeBtn = document.getElementById('home-btn');
  const backBtn = document.getElementById('back-btn');
  const forwardBtn = document.getElementById('forward-btn');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const hideBarBtn = document.getElementById('hide-bar-btn');
  const revealBtn = document.getElementById('reveal-bar');
  const newTabStripBtn = document.getElementById('tab-new');

  if (homeBtn) homeBtn.addEventListener('click', () => goTo('/main.html'));
  if (backBtn) backBtn.addEventListener('click', () => frameHistoryGo(-1));
  if (forwardBtn) forwardBtn.addEventListener('click', () => frameHistoryGo(1));
  if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
  if (hideBarBtn) hideBarBtn.addEventListener('click', () => setBarHidden(true));
  if (revealBtn) revealBtn.addEventListener('click', () => setBarHidden(false));
  if (newTabStripBtn) newTabStripBtn.addEventListener('click', () => openTab(null));

  const strip = document.getElementById('tab-list');
  if (strip) {
    strip.addEventListener('dblclick', (e) => { if (e.target === strip) openTab(null); });
    strip.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { strip.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });
  }

  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      goTo(link.getAttribute('href'));
    });
  });

  const omni = document.getElementById('omnibox');
  const urlDisplay = document.getElementById('url-display');

  if (urlDisplay) urlDisplay.addEventListener('click', () => setEditing(true));

  if (urlInput) {
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const url = urlInput.value.trim();
        if (url) {
          setEditing(false);
          navigateToUrl(url);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditing(false);
        paintDisplay(currentDestination);
      }
    });
    urlInput.addEventListener('blur', () => {
      if (omni) omni.classList.remove('editing');
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && hasTabStrip()) {
      if (e.code === 'KeyT') { e.preventDefault(); openTab(null); return; }
      if (e.code === 'KeyW' && activeTab) { e.preventDefault(); closeTab(activeTab); return; }
      const digit = /^Digit([1-9])$/.exec(e.code);
      if (digit) {
        e.preventDefault();
        const n = Number(digit[1]);
        switchTab(n === 9 ? tabs[tabs.length - 1] : tabs[n - 1]);
        return;
      }
    }
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'l' && urlInput) {
      e.preventDefault();
      setEditing(true);
    } else if (key === 'r' && refreshBtn) {
      e.preventDefault();
      refreshBtn.click();
    }
  });

  const newTabBtn = document.getElementById('newtab-btn');
  if (newTabBtn) {
    newTabBtn.addEventListener('click', () => {
      if (!currentDestination) return;
      window.open('/s#' + encodeURIComponent(currentDestination), '_blank', 'noopener');
    });
  }

  paintEngineChip();
  window.addEventListener('storage', (e) => {
    if (e.key === 'onlylessons_proxy_backend') paintEngineChip();
  });

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (currentDestination) {
        navigateToUrl(currentDestination);
      } else {
        try {
          const decoded = OnlyProxy.decodeUrl(activeFrame().contentWindow.location.href);
          if (decoded) navigateToUrl(decoded);
        } catch (e) {}
      }
    });
  }

  const first = document.getElementById('proxy-iframe');
  if (!first) return;
  frameAttrs = ['sandbox', 'allow', 'allowfullscreen']
    .filter((a) => first.hasAttribute(a))
    .map((a) => [a, first.getAttribute(a)]);

  const fromHash = hashDestination();
  const saved = hasTabStrip() ? loadSavedTabs() : null;
  let start;

  if (saved) {
    saved.tabs.forEach((u, i) => makeTab(i === 0 ? first : newFrame(), u));
    tabs.forEach((t) => t.iframe.classList.add('is-bg'));
    start = tabs[Math.min(Math.max(0, saved.active | 0), tabs.length - 1)];
    if (fromHash) {
      start = tabs.find((t) => t.url === fromHash) || makeTab(newFrame(), fromHash);
      start.iframe.classList.add('is-bg');
    }
  } else {
    let destination = fromHash || null;
    if (!destination && fromHash === null) {
      try {
        const last = sessionStorage.getItem(STORAGE_KEY);
        if (last) {
          destination = new URL(last).toString();
          history.replaceState(null, '', '#' + encodeURIComponent(destination));
        }
      } catch (e) {}
    }
    start = makeTab(first, destination);
  }

  switchTab(start);
  watchTabs();

  if (fromHash === false) {
    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.style.display = 'none';
    const overlay = document.getElementById('loading-overlay');
    if (overlay) { overlay.style.display = 'flex'; overlay.style.opacity = '1'; }
    const theh1 = document.getElementById('theh1');
    const thep = document.getElementById('thep');
    if (theh1) theh1.innerText = "Invalid URL";
    if (thep) thep.innerText = "The URL provided is invalid";
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEmbed);
} else {
  initEmbed();
}
