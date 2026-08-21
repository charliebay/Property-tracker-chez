// Weekly orchestrator: for each tracked property, scrapes an estimated
// value from Domain; for each tracked suburb, scrapes a median-price trend
// from a free source chosen by state (VIC: the official Victorian Property
// Sales Report CSV; WA: REIWA's suburb profile page); pulls property-market
// news via Google News RSS; writes everything to a Google Sheet.
//
// Failure philosophy: every property/suburb/news item is scraped
// independently, so one blocked/broken item never stops the others. Rows are
// written to each tab as soon as that category's scrape loop finishes, so a
// crash partway through still preserves earlier results. The process only
// exits non-zero if the Sheets write itself fails (auth/API problem) - not
// when individual scrapes are blocked, since that's an expected outcome some
// weeks and is recorded in each row's `status` column instead.

const fs = require('fs');
const targets = require('./config/targets');
const { launchBrowser, newContext, randomDelay, withRetry } = require('./lib/browser');
const { resolveDomainProperty } = require('./lib/resolveDomainProperty');
const { scrapeDomainProperty } = require('./lib/scrapeDomainProperty');
const { scrapeVicSuburbTrend } = require('./lib/scrapeVicSuburbTrend');
const { scrapeReiwaSuburbTrend } = require('./lib/scrapeReiwaSuburbTrend');
const { scrapeNews } = require('./lib/scrapeNews');
const { getSheetsClient } = require('./sheets/serviceAccountClient');
const { ensureTab } = require('./sheets/ensureSheet');
const { appendRows } = require('./sheets/appendRows');

const PROPERTY_HEADERS = [
  'date', 'address', 'suburb', 'estimate', 'confidence',
  'beds', 'baths', 'car', 'lastUpdated', 'sourceUrl', 'source', 'status',
];
const SUBURB_HEADERS = [
  'date', 'suburb', 'medianPrice', 'qoqChangePct', 'projectionText', 'sourceUrl', 'source', 'status',
];
const NEWS_HEADERS = ['dateScraped', 'suburb', 'headline', 'source', 'publishedDate', 'link'];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Builds a row in header order from a plain object, so adding/reordering
// columns can't silently misalign values by position.
function rowFromHeaders(headers, data) {
  return headers.map((h) => (data[h] ?? '') + '');
}

async function scrapePropertyRows(context, date) {
  const rows = [];
  const summary = [];

  for (const property of targets.properties) {
    try {
      const profileUrl = await withRetry(() => resolveDomainProperty(context, property.address));
      const result = await withRetry(() => scrapeDomainProperty(context, profileUrl));
      rows.push(rowFromHeaders(PROPERTY_HEADERS, { date, address: property.address, suburb: property.suburb, ...result }));
      summary.push({ label: `Property: ${property.address}`, ok: true });
    } catch (err) {
      rows.push(rowFromHeaders(PROPERTY_HEADERS, {
        date, address: property.address, suburb: property.suburb, status: String(err.message || err),
      }));
      summary.push({ label: `Property: ${property.address}`, ok: false, error: String(err.message || err) });
    }
    await randomDelay();
  }

  return { rows, summary };
}

// Routes each suburb to a free data source by state - VIC has a solid
// official CSV dataset, WA doesn't (REIWA's suburb profile page is the best
// free option found). Suburbs outside these two states aren't covered yet.
async function scrapeSuburbTrend(context, suburb) {
  if (suburb.state === 'VIC') {
    return scrapeVicSuburbTrend(suburb);
  }
  if (suburb.state === 'WA') {
    return scrapeReiwaSuburbTrend(context, suburb);
  }
  throw new Error(`No suburb-trend source configured for state ${suburb.state}`);
}

async function scrapeSuburbRows(context, date) {
  const rows = [];
  const summary = [];

  for (const suburb of targets.suburbs) {
    try {
      const result = await withRetry(() => scrapeSuburbTrend(context, suburb));
      rows.push(rowFromHeaders(SUBURB_HEADERS, { date, suburb: suburb.suburb, ...result }));
      summary.push({ label: `Suburb: ${suburb.suburb} (${result.source})`, ok: true });
    } catch (err) {
      rows.push(rowFromHeaders(SUBURB_HEADERS, { date, suburb: suburb.suburb, status: String(err.message || err) }));
      summary.push({ label: `Suburb: ${suburb.suburb}`, ok: false, error: String(err.message || err) });
    }
    await randomDelay();
  }

  return { rows, summary };
}

async function scrapeNewsRows(dateScraped) {
  const rows = [];
  const summary = [];

  for (const suburb of targets.suburbs) {
    try {
      const items = await withRetry(() => scrapeNews(suburb, targets.newsKeywords));
      for (const item of items) {
        rows.push([dateScraped, suburb.suburb, item.headline, item.source, item.publishedDate, item.link]);
      }
      summary.push({ label: `News: ${suburb.suburb}`, ok: true, detail: `${items.length} items` });
    } catch (err) {
      summary.push({ label: `News: ${suburb.suburb}`, ok: false, error: String(err.message || err) });
    }
  }

  return { rows, summary };
}

function writeStepSummary(allSummary) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  const lines = ['## Property Value Tracker - Weekly Run', '', '| Item | Status |', '|---|---|'];
  for (const entry of allSummary) {
    const status = entry.ok ? `OK${entry.detail ? ` (${entry.detail})` : ''}` : `FAILED: ${entry.error}`;
    lines.push(`| ${entry.label} | ${status} |`);
  }
  const text = lines.join('\n');
  console.log(text);
  if (summaryPath) {
    fs.appendFileSync(summaryPath, `${text}\n`);
  }
}

async function notify(allSummary) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;

  const okCount = allSummary.filter((e) => e.ok).length;
  const total = allSummary.length;
  const message = `Property tracker updated: ${okCount}/${total} items OK`;

  try {
    await fetch(`https://ntfy.sh/${topic}`, { method: 'POST', body: message });
  } catch (err) {
    console.error(`ntfy notification failed: ${err.message}`);
  }
}

async function main() {
  const spreadsheetId = process.env.SHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SHEET_ID is not set');
  }

  const date = todayIso();
  const browser = await launchBrowser();
  const context = await newContext(browser);

  let propertyResult;
  let suburbResult;
  let newsResult;
  try {
    propertyResult = await scrapePropertyRows(context, date);
    suburbResult = await scrapeSuburbRows(context, date);
    newsResult = await scrapeNewsRows(date);
  } finally {
    await browser.close();
  }

  // Writing to Sheets is the one failure mode that fails the whole job -
  // everything above (individual scrapes) is allowed to fail per-item.
  const sheets = await getSheetsClient();
  await ensureTab(sheets, spreadsheetId, 'PropertySnapshots', PROPERTY_HEADERS);
  await appendRows(sheets, spreadsheetId, 'PropertySnapshots', propertyResult.rows);

  await ensureTab(sheets, spreadsheetId, 'SuburbTrends', SUBURB_HEADERS);
  await appendRows(sheets, spreadsheetId, 'SuburbTrends', suburbResult.rows);

  await ensureTab(sheets, spreadsheetId, 'NewsItems', NEWS_HEADERS);
  await appendRows(sheets, spreadsheetId, 'NewsItems', newsResult.rows);

  const allSummary = [...propertyResult.summary, ...suburbResult.summary, ...newsResult.summary];
  writeStepSummary(allSummary);
  await notify(allSummary);
}

main().catch((err) => {
  console.error('Property tracker run failed:', err);
  process.exit(1);
});
