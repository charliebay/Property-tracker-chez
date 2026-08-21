// Resolves a plain-text address to its canonical domain.com.au property
// profile URL by driving the site's own on-page search, the same approach
// used for realestate.com.au - profile URLs aren't derivable from the
// address alone.
//
// UNVERIFIED: this session's network cannot reach domain.com.au (same
// proxy policy that blocked realestate.com.au), so these locators are a
// best-effort guess, not confirmed against the live site. Expect this to
// need the same fix-from-real-selectors cycle the REA resolver went
// through - see README for how to supply real selectors if this times out
// in a workflow run.

async function resolveDomainProperty(context, address) {
  const page = await context.newPage();
  try {
    await page.goto('https://www.domain.com.au/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const searchBox = page
      .getByPlaceholder(/suburb|address|postcode|search/i)
      .or(page.getByRole('combobox'))
      .or(page.getByRole('searchbox'))
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
    if (!url.includes('domain.com.au')) {
      throw new Error(`Unexpected post-search URL: ${url}`);
    }
    return url;
  } finally {
    await page.close();
  }
}

module.exports = { resolveDomainProperty };
