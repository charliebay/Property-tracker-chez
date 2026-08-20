// Resolves a plain-text address (e.g. "9 Tranmere Street, Fitzroy North VIC
// 3068") to its canonical realestate.com.au property profile URL, by driving
// the site's own on-page address search rather than guessing/constructing a
// URL - property profile URLs are keyed by an internal numeric ID that isn't
// derivable from the address alone.
//
// NOTE: the search box / suggestion-list locators below are best-effort and
// may need adjusting once run against the live site - see README for how to
// debug a selector miss (run.js records it as a RESOLVE_FAILED status rather
// than crashing the whole job).

async function resolveProperty(context, address) {
  const page = await context.newPage();
  try {
    await page.goto('https://www.realestate.com.au/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const searchBox = page
      .getByPlaceholder(/suburb|address|postcode/i)
      .or(page.getByRole('combobox'))
      .first();
    await searchBox.waitFor({ state: 'visible', timeout: 15000 });
    await searchBox.fill(address);

    const firstSuggestion = page.getByRole('option').first();
    await firstSuggestion.waitFor({ state: 'visible', timeout: 10000 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
      firstSuggestion.click(),
    ]);

    const url = page.url();
    if (!url.includes('realestate.com.au')) {
      throw new Error(`Unexpected post-search URL: ${url}`);
    }
    return url;
  } finally {
    await page.close();
  }
}

module.exports = { resolveProperty };
