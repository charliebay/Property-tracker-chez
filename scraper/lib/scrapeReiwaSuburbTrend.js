const { extractEmbeddedJsonBlobs, findFirstByKeySubstring, extractDollarNearText } = require('./parseEmbeddedJson');
const { looksLikeChallengePage } = require('./browser');

// REIWA (the WA real estate institute) publishes a per-suburb profile page
// at a predictable URL - reiwa.com.au/suburb/<slug>/ (confirmed to exist
// for at least reiwa.com.au/suburb/perth/ via search results). This is a
// better-structured source than REIWA's "weekly market snapshot" articles,
// which are narrative news prose rather than a downloadable dataset.
//
// UNVERIFIED: this session's network can't reach reiwa.com.au to confirm
// the page's actual structure - same caveat as the Domain scraper.
function buildReiwaSuburbUrl(suburb) {
  if (suburb.reiwaSlugOverride) {
    return `https://reiwa.com.au/suburb/${suburb.reiwaSlugOverride}/`;
  }
  const slug = suburb.suburb.toLowerCase().trim().replace(/\s+/g, '-');
  return `https://reiwa.com.au/suburb/${slug}/`;
}

async function scrapeReiwaSuburbTrend(context, suburb) {
  const url = buildReiwaSuburbUrl(suburb);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const html = await page.content();

    if (looksLikeChallengePage(html)) {
      throw new Error('BLOCKED: bot-detection challenge page');
    }

    const blobs = extractEmbeddedJsonBlobs(html);
    const bodyText = await page.locator('body').innerText().catch(() => '');

    const medianPrice =
      findFirstByKeySubstring(blobs, ['medianprice', 'median']) || extractDollarNearText(bodyText, 'median');
    const qoqChangePct = findFirstByKeySubstring(blobs, ['quarterlychange', 'qoq', 'quarteronquarter', 'growth']);
    const projectionText = findFirstByKeySubstring(blobs, ['projection', 'forecast']);

    if (!medianPrice && !qoqChangePct && !projectionText) {
      throw new Error('SELECTOR_MISS: no suburb trend fields found');
    }

    return {
      medianPrice: medianPrice ?? '',
      qoqChangePct: qoqChangePct ?? '',
      projectionText: projectionText ?? '',
      sourceUrl: url,
      source: 'REIWA',
      status: 'OK',
    };
  } finally {
    await page.close();
  }
}

module.exports = { scrapeReiwaSuburbTrend, buildReiwaSuburbUrl };
