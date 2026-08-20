const { extractArgonautJson, findFirstByKeySubstring, extractDollarNearText } = require('./parseArgonaut');
const { looksLikeChallengePage } = require('./browser');

// Scrapes a single realestate.com.au property profile page for its
// realEstimate valuation and basic attributes.
async function scrapeProperty(context, profileUrl) {
  const page = await context.newPage();
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const html = await page.content();

    if (looksLikeChallengePage(html)) {
      throw new Error('BLOCKED: bot-detection challenge page');
    }

    const data = extractArgonautJson(html);
    const bodyText = await page.locator('body').innerText().catch(() => '');

    const estimate =
      (data && findFirstByKeySubstring(data, ['estimate', 'avm', 'valuation'])) ||
      extractDollarNearText(bodyText, 'confidence');
    const confidence = data && findFirstByKeySubstring(data, ['confidence']);
    const beds = data && findFirstByKeySubstring(data, ['bedroom']);
    const baths = data && findFirstByKeySubstring(data, ['bathroom']);
    const car = data && findFirstByKeySubstring(data, ['carspace', 'parking']);
    const lastUpdated = data && findFirstByKeySubstring(data, ['updated', 'asat', 'valuationdate']);

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
      status: 'OK',
    };
  } finally {
    await page.close();
  }
}

module.exports = { scrapeProperty };
