const { extractEmbeddedJsonBlobs, findFirstByKeySubstring, extractDollarNearText } = require('./parseEmbeddedJson');
const { looksLikeChallengePage } = require('./browser');

// Scrapes a single domain.com.au property profile page for its estimated
// value ("Price Guide") and basic attributes.
//
// UNVERIFIED: same caveat as resolveDomainProperty.js - this session can't
// reach domain.com.au to confirm the page structure or embedded JSON key
// names, and it's unknown whether Domain's estimate figures render fully
// for an anonymous visitor or are gated behind sign-in/a free-lookup limit.
// If every property comes back SELECTOR_MISS or BLOCKED on a real run,
// that gating is the most likely explanation - see README.
async function scrapeDomainProperty(context, profileUrl) {
  const page = await context.newPage();
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const html = await page.content();

    if (looksLikeChallengePage(html)) {
      throw new Error('BLOCKED: bot-detection challenge page');
    }

    const blobs = extractEmbeddedJsonBlobs(html);
    const bodyText = await page.locator('body').innerText().catch(() => '');

    const estimate =
      findFirstByKeySubstring(blobs, ['estimate', 'priceguide', 'avm', 'valuation']) ||
      extractDollarNearText(bodyText, 'price guide') ||
      extractDollarNearText(bodyText, 'estimate');
    const confidence = findFirstByKeySubstring(blobs, ['confidence']);
    const beds = findFirstByKeySubstring(blobs, ['bedroom']);
    const baths = findFirstByKeySubstring(blobs, ['bathroom']);
    const car = findFirstByKeySubstring(blobs, ['carspace', 'parking']);
    const lastUpdated = findFirstByKeySubstring(blobs, ['updated', 'asat', 'valuationdate']);

    if (!estimate) {
      throw new Error('SELECTOR_MISS: estimate');
    }

    return {
      estimate,
      confidence: confidence || '',
      beds: beds ?? '',
      baths: baths ?? '',
      car: car ?? '',
      lastUpdated: lastUpdated || '',
      sourceUrl: profileUrl,
      source: 'Domain',
      status: 'OK',
    };
  } finally {
    await page.close();
  }
}

module.exports = { scrapeDomainProperty };
