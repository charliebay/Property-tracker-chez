// Playwright helpers shared by the property/suburb scrapers: a realistic
// browser context, a retry-once wrapper, and a randomized inter-request delay
// so the weekly job behaves less like a bot hammering the site.

const { chromium } = require('playwright');

const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function launchBrowser() {
  return chromium.launch({ headless: true });
}

async function newContext(browser) {
  return browser.newContext({
    userAgent: DESKTOP_USER_AGENT,
    viewport: { width: 1366, height: 900 },
    locale: 'en-AU',
    extraHTTPHeaders: {
      'Accept-Language': 'en-AU,en;q=0.9',
    },
  });
}

function randomDelay(minMs = 3000, maxMs = 8000) {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Runs fn() once, and on failure waits delayMs then tries exactly once more.
// Throws the last error if both attempts fail - callers are expected to
// catch this and record a status rather than let it propagate further.
async function withRetry(fn, { retries = 1, delayMs = 4000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastErr;
}

// Heuristic check for an Akamai (or similar) bot-detection challenge page,
// so callers can treat it as a distinct, expected failure mode rather than a
// generic selector miss.
function looksLikeChallengePage(html) {
  if (!html) return false;
  const lower = html.toLowerCase();
  return (
    lower.includes('akamai') ||
    lower.includes('access denied') ||
    lower.includes('request blocked') ||
    lower.includes('pardon our interruption')
  );
}

module.exports = {
  launchBrowser,
  newContext,
  randomDelay,
  withRetry,
  looksLikeChallengePage,
};
