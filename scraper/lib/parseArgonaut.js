// realestate.com.au's rendered pages embed their data-fetching state as a
// large JSON blob assigned to `window.ArgonautExchange` in an inline
// <script> tag. That's a far more stable extraction target than CSS/DOM
// selectors, but the exact key names inside it are undocumented and can
// drift - so instead of hardcoding one deep path (e.g. data.property.estimate),
// we walk the whole object looking for keys that match a pattern. If that
// finds nothing, callers fall back to regex-over-visible-text extraction.
//
// NOTE: the key-name patterns below are best-effort guesses based on how
// realestate.com.au's realEstimate/market-insights features are named
// publicly. The first live run will likely need these patterns adjusted
// once the actual embedded JSON shape (or DOM markup, if the JSON approach
// fails entirely) can be inspected - see the `status` column in the sheet,
// which will read SELECTOR_MISS if nothing matches.

const ARGONAUT_PATTERN = /window\.ArgonautExchange\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|window\.)/;

function extractArgonautJson(html) {
  if (!html) return null;
  const match = html.match(ARGONAUT_PATTERN);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (err) {
    return null;
  }
}

// Recursively walks `obj`, calling `predicate(key, value)` for every
// key/value pair. Returns every {path, key, value} where predicate is true.
// Bounded by maxDepth/maxResults so a huge or cyclic-ish payload can't hang
// the scrape.
function deepFindValues(obj, predicate, { maxDepth = 12, maxResults = 20 } = {}) {
  const results = [];
  const seen = new Set();

  function walk(node, path, depth) {
    if (results.length >= maxResults) return;
    if (depth > maxDepth || node === null || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);

    for (const [key, value] of Object.entries(node)) {
      if (results.length >= maxResults) return;
      if (predicate(key, value)) {
        results.push({ path: `${path}.${key}`, key, value });
      }
      if (value && typeof value === 'object') {
        walk(value, `${path}.${key}`, depth + 1);
      }
    }
  }

  walk(obj, '$', 0);
  return results;
}

// Convenience: find the first value whose key contains any of `substrings`
// (case-insensitive) and whose value passes `valueCheck` (defaults to
// "is a non-empty primitive").
function findFirstByKeySubstring(obj, substrings, valueCheck = defaultValueCheck) {
  const lowerSubstrings = substrings.map((s) => s.toLowerCase());
  const matches = deepFindValues(
    obj,
    (key, value) =>
      lowerSubstrings.some((s) => key.toLowerCase().includes(s)) && valueCheck(value),
    { maxResults: 5 }
  );
  return matches.length > 0 ? matches[0].value : undefined;
}

function defaultValueCheck(value) {
  return (
    (typeof value === 'string' && value.trim().length > 0) ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

// Fallback for when the JSON blob is missing/unparseable or the expected
// keys aren't found in it: pull a dollar figure out of the raw page text
// near a given anchor phrase (e.g. "confidence").
function extractDollarNearText(text, anchorPhrase, windowChars = 200) {
  if (!text) return undefined;
  const anchorIndex = text.toLowerCase().indexOf(anchorPhrase.toLowerCase());
  const searchText =
    anchorIndex === -1 ? text : text.slice(Math.max(0, anchorIndex - windowChars), anchorIndex + windowChars);
  const match = searchText.match(/\$[\d,]+(?:k|K)?/);
  return match ? match[0] : undefined;
}

module.exports = {
  extractArgonautJson,
  deepFindValues,
  findFirstByKeySubstring,
  extractDollarNearText,
};
