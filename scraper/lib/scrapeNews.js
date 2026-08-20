const Parser = require('rss-parser');

const parser = new Parser({
  customFields: { item: ['source'] },
  timeout: 15000,
});

const MAX_ITEMS_PER_SUBURB = 5;

// Google News RSS is a public, purpose-built-for-automation feed, so this
// sidesteps the ToS problem of scraping arbitrary news sites directly while
// still surfacing property-market news for each tracked suburb.
async function scrapeNews(suburb, newsKeywords) {
  const keywordClause = newsKeywords.map((k) => `"${k}"`).join(' OR ');
  const query = `"${suburb.suburb}" ${suburb.state} (${keywordClause})`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-AU&gl=AU&ceid=AU:en`;

  const feed = await parser.parseURL(url);
  return (feed.items || []).slice(0, MAX_ITEMS_PER_SUBURB).map((item) => ({
    headline: item.title || '',
    link: item.link || '',
    source: typeof item.source === 'string' ? item.source : (item.source && item.source._) || '',
    publishedDate: item.pubDate || '',
    snippet: item.contentSnippet || '',
  }));
}

module.exports = { scrapeNews };
