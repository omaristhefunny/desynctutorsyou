"use strict";

function showXPError(title, message, windowTitle = "Error") {
  const xpErrorHTML = `
    <div class="xp-error-overlay">
      <div class="xp-error">
        <div class="xp-titlebar">
          <div class="xp-title-text">
            <svg class="xp-icon" viewBox="0 0 16 16" fill="white">
              <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm1 13H7v-2h2v2zm0-3H7V4h2v6z"/>
            </svg>
            <span>${windowTitle}</span>
          </div>
          <button class="xp-close" onclick="window.location.href='index.html'">×</button>
        </div>
        <div class="xp-content">
          <svg class="xp-error-icon" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="15" fill="#c00" stroke="#fff" stroke-width="1"/>
            <path d="M10 10l12 12M22 10L10 22" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
          </svg>
          <div class="xp-message">
            <div class="xp-message-title">${title}</div>
            <div class="xp-message-text">${message}</div>
          </div>
        </div>
        <div class="xp-buttons">
          <button class="xp-button" onclick="location.reload()">Retry</button>
          <button class="xp-button" onclick="window.location.href='index.html'">Close</button>
        </div>
      </div>
    </div>
  `;

  const xpErrorStyles = `
    <style id="xp-error-styles">
      .xp-error-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
      }

      .xp-error {
        width: 400px;
        background: linear-gradient(180deg, #0054e3 0%, #0054e3 22px, #ece9d8 22px);
        border: 3px solid;
        border-color: #0831d9 #0831d9 #c6cdd6 #c6cdd6;
        box-shadow: 2px 2px 5px rgba(0,0,0,0.3);
        font-family: 'Tahoma', sans-serif;
      }

      .xp-titlebar {
        height: 22px;
        padding: 2px 4px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: white;
        font-size: 11px;
        font-weight: bold;
      }

      .xp-title-text {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .xp-icon {
        width: 16px;
        height: 16px;
      }

      .xp-close {
        width: 16px;
        height: 14px;
        background: linear-gradient(180deg, #f5b5b5 0%, #e34234 50%, #c92e1f 50%, #b92616 100%);
        border: 1px solid;
        border-color: #fff #000 #000 #fff;
        cursor: pointer;
        font-size: 10px;
        font-weight: bold;
        color: white;
        text-align: center;
        line-height: 12px;
      }

      .xp-close:active {
        border-color: #000 #fff #fff #000;
      }

      .xp-content {
        padding: 12px;
        background: #ece9d8;
        display: flex;
        gap: 12px;
      }

      .xp-error-icon {
        width: 32px;
        height: 32px;
        flex-shrink: 0;
      }

      .xp-message {
        flex: 1;
      }

      .xp-message-title {
        font-size: 11px;
        font-weight: bold;
        margin-bottom: 8px;
        color: #000;
      }

      .xp-message-text {
        font-size: 11px;
        color: #000;
        line-height: 1.4;
        word-break: break-word;
        white-space: pre-line;
      }

      .xp-buttons {
        padding: 12px;
        background: #ece9d8;
        display: flex;
        justify-content: center;
        gap: 8px;
      }

      .xp-button {
        min-width: 75px;
        padding: 3px 8px;
        background: linear-gradient(180deg, #fff 0%, #ece9d8 100%);
        border: 1px solid;
        border-color: #fff #000 #000 #fff;
        font-family: 'Tahoma', sans-serif;
        font-size: 11px;
        color: #000;
        cursor: pointer;
        box-shadow: inset -1px -1px 0 #808080, inset 1px 1px 0 #dfdfdf;
      }

      .xp-button:hover {
        background: linear-gradient(180deg, #fff 0%, #f0ede5 100%);
      }

      .xp-button:active {
        border-color: #000 #fff #fff #000;
        box-shadow: inset 1px 1px 0 #808080;
      }
    </style>
  `;

  if (!document.getElementById('xp-error-styles')) {
    document.head.insertAdjacentHTML('beforeend', xpErrorStyles);
  }

  const loadingBox = document.getElementById('loadingbox');
  const loader = document.querySelector('.loader');
  const fadeout = document.getElementById('fadeout');
  
  if (loadingBox) loadingBox.style.display = 'none';
  if (loader) loader.style.display = 'none';
  if (fadeout) fadeout.style.opacity = '0';

  document.body.insertAdjacentHTML('beforeend', xpErrorHTML);
}

function initEmbed() {
  let destination = "";
  
  const hash = window.location.hash.slice(1);
  
  if (!hash) {
    console.error("hey twin, sum went wrong here. heres how to do the thing embed.html#https://example.com");
    showXPError(
      "No URL Found",
      "Expected format: embed.html#https://example.com\n\nIf this is unexpected, report to @suntree.network on Discord.",
      "Embed Error"
    );
    return;
  }
  
  try {
    const decodedHash = decodeURIComponent(hash);
    destination = new URL(decodedHash).toString();
  } catch (err) {
    console.error(`Bad # string or bad URL. Got error: ${err}`);
    showXPError(
      "Invalid URL",
      `Unable to load the requested URL.\n\nError: ${err.message}\n\nIf this is unexpected, report to @suntree.network on Discord.`,
      "URL Error"
    );
    return;
  }

  registerSW()
    .then(() => {        
      window.open(
        __uv$config.prefix + __uv$config.encodeUrl(destination),
        "_self"
      );
    })
    .catch((err) => {
      console.error(`Encountered error: ${err}`);
      showXPError(
        "Proxy Error",
        `Failed to initialize proxy service.\n\nError: ${err.message}\n\nPlease try again or contact support.`,
        "Proxy Error"
      );
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEmbed);
} else {
  initEmbed();
}