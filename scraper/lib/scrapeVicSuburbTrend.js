const { parse } = require('csv-parse/sync');

// Victoria publishes the Victorian Property Sales Report as free, CC BY 4.0
// CSVs on the state's open-data portal (discover.data.vic.gov.au), which
// runs CKAN - a standard open-data platform with a stable JSON API. Rather
// than hardcoding a CSV download URL (which changes every quarterly
// release), this queries the CKAN API for the dataset's current resource
// URL each run, then downloads and parses that CSV directly - no browser,
// no scraping, no ToS risk, since this is official data meant for exactly
// this kind of automated use.
const CKAN_PACKAGE_SHOW_URL =
  'https://discover.data.vic.gov.au/api/3/action/package_show?id=victorian-property-sales-report-median-house-by-suburb';

async function findCsvResourceUrl() {
  const res = await fetch(CKAN_PACKAGE_SHOW_URL);
  if (!res.ok) {
    throw new Error(`CKAN package_show request failed: HTTP ${res.status}`);
  }
  const body = await res.json();
  if (!body.success) {
    throw new Error('CKAN package_show returned success:false');
  }
  const resources = body.result.resources || [];
  const csvResource = resources.find((r) => (r.format || '').toUpperCase() === 'CSV');
  if (!csvResource) {
    throw new Error('No CSV resource found on the VPSR dataset');
  }
  return csvResource.url;
}

function parseMoney(raw) {
  if (raw == null) return NaN;
  const cleaned = String(raw).replace(/[^0-9.-]/g, '');
  return cleaned ? parseFloat(cleaned) : NaN;
}

// Suburb name matching is case-insensitive and ignores punctuation, since
// the exact suburb column header/casing convention in the CSV is unverified.
function normalizeSuburbName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Scrapes (via CSV download, not a browser) the latest median house price
// and quarter-on-quarter change for one suburb from the VPSR dataset.
async function scrapeVicSuburbTrend(suburb) {
  const csvUrl = await findCsvResourceUrl();
  const csvRes = await fetch(csvUrl);
  if (!csvRes.ok) {
    throw new Error(`Failed to download VPSR CSV: HTTP ${csvRes.status}`);
  }
  const csvText = await csvRes.text();

  const records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  if (records.length === 0) {
    throw new Error('VPSR CSV parsed to zero rows');
  }

  const headers = Object.keys(records[0]);
  const suburbColumn = headers.find((h) => h.toLowerCase().includes('suburb'));
  if (!suburbColumn) {
    throw new Error('SELECTOR_MISS: no suburb column found in VPSR CSV');
  }

  const targetNormalized = normalizeSuburbName(suburb.suburb);
  const row = records.find((r) => normalizeSuburbName(r[suburbColumn]) === targetNormalized);
  if (!row) {
    throw new Error(`Suburb "${suburb.suburb}" not found in VPSR CSV`);
  }

  // Every non-suburb column is assumed to be a chronological quarter/period
  // column, in the order the report publishes them (oldest to newest).
  const periodColumns = headers.filter((h) => h !== suburbColumn);
  const numericByColumn = periodColumns
    .map((h) => ({ header: h, value: parseMoney(row[h]) }))
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 0);

  if (numericByColumn.length === 0) {
    throw new Error('SELECTOR_MISS: no numeric period columns found for this suburb');
  }

  const latest = numericByColumn[numericByColumn.length - 1];
  const previous = numericByColumn.length > 1 ? numericByColumn[numericByColumn.length - 2] : null;
  const qoqChangePct = previous
    ? `${(((latest.value - previous.value) / previous.value) * 100).toFixed(1)}%`
    : '';

  return {
    medianPrice: latest.value,
    qoqChangePct,
    projectionText: '',
    sourceUrl: csvUrl,
    source: 'VIC Property Sales Report',
    status: 'OK',
  };
}

module.exports = { scrapeVicSuburbTrend };
