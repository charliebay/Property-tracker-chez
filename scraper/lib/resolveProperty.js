// Resolves a plain-text address (e.g. "9 Tranmere Street, Fitzroy North VIC
// 3068") to its canonical realestate.com.au property profile URL, by driving
// the site's own on-page address search rather than guessing/constructing a
// URL - property profile URLs are keyed by an internal numeric ID that isn't
// derivable from the address alone.
//
// Selectors confirmed against the live site (2026-08-21): the homepage
// search input is #large-screen-search-input, an ARIA combobox whose
// suggestions render in the #large-screen-search-menu listbox. Typing a full
// street address and clicking the first suggestion navigates straight to the
// property's profile page (e.g. /property/9-tranmere-st-fitzroy-north-vic-3068/).

async function resolveProperty(context, address) {
  const page = await context.newPage();
  try {
    await page.goto('https://www.realestate.com.au/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const searchBox = page.locator('#large-screen-search-input').or(page.getByRole('combobox')).first();
    await searchBox.waitFor({ state: 'visible', timeout: 15000 });
    await searchBox.fill(address);

    const suggestionList = page.locator('#large-screen-search-menu');
    const firstSuggestion = suggestionList.getByRole('option').first().or(page.getByRole('option').first());
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
