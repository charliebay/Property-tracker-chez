const { extractArgonautJson, findFirstByKeySubstring } = require('./parseArgonaut');
const { looksLikeChallengePage } = require('./browser');

// realestate.com.au's suburb/neighbourhood profile pages follow a
// predictable slug pattern, so (unlike individual properties) we can build
// the URL directly instead of driving an on-site search. `urlSlugOverride`
// in scraper/config/targets.js can replace this if the built slug turns out
// to be wrong for a given suburb once run against the live site.
function buildSuburbUrl(suburb) {
  if (suburb.urlSlugOverride) {
    return `https://www.realestate.com.au/neighbourhoods/${suburb.urlSlugOverride}`;
  }
  const slug = suburb.suburb.toLowerCase().trim().replace(/\s+/g, '-');
  return `https://www.realestate.com.au/neighbourhoods/${slug}-${suburb.postcode}-${suburb.state.toLowerCase()}`;
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
    const medianPrice = data && findFirstByKeySubstring(data, ['medianprice', 'median']);
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
