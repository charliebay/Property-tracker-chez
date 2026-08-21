const { extractArgonautJson, findFirstByKeySubstring, extractDollarNearText } = require('./parseArgonaut');
const { looksLikeChallengePage } = require('./browser');

// realestate.com.au's suburb profile pages follow a predictable slug
// pattern confirmed against the live site (2026-08-21):
// https://www.realestate.com.au/<state-lower>/<suburb-slug>-<postcode>/
// e.g. https://www.realestate.com.au/vic/fitzroy-north-3068/
// `urlSlugOverride` in scraper/config/targets.js can replace the built
// path (minus the https://www.realestate.com.au/ prefix) if a suburb's
// real slug ever diverges from this pattern (e.g. multi-word suburb names
// with unusual punctuation).
function buildSuburbUrl(suburb) {
  if (suburb.urlSlugOverride) {
    return `https://www.realestate.com.au/${suburb.urlSlugOverride}`;
  }
  const slug = suburb.suburb.toLowerCase().trim().replace(/\s+/g, '-');
  return `https://www.realestate.com.au/${suburb.state.toLowerCase()}/${slug}-${suburb.postcode}/`;
}

// Scrapes a suburb profile page for median price / QoQ change / any
// published price projection (realestate.com.au surfaces PropTrack market
// insights on these pages).
async function scrapeSuburb(context, suburb) {
  const url = buildSuburbUrl(suburb);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const html = await page.content();

    if (looksLikeChallengePage(html)) {
      throw new Error('BLOCKED: bot-detection challenge page');
    }

    const data = extractArgonautJson(html);
    const bodyText = await page.locator('body').innerText().catch(() => '');

    const medianPrice =
      (data && findFirstByKeySubstring(data, ['medianprice', 'median'])) ||
      extractDollarNearText(bodyText, 'median');
    const qoqChangePct = data && findFirstByKeySubstring(data, ['quarterlychange', 'qoq', 'quarteronquarter']);
    const projectionText = data && findFirstByKeySubstring(data, ['projection', 'forecast']);

    if (!medianPrice && !qoqChangePct && !projectionText) {
      throw new Error('SELECTOR_MISS: no suburb trend fields found');
    }

    return {
      medianPrice: medianPrice ?? '',
      qoqChangePct: qoqChangePct ?? '',
      projectionText: projectionText ?? '',
      sourceUrl: url,
      status: 'OK',
    };
  } finally {
    await page.close();
  }
}

module.exports = { scrapeSuburb, buildSuburbUrl };
