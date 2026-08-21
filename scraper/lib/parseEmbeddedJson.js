// Modern property sites typically embed their page data as JSON in the
// HTML rather than relying purely on server-rendered markup - e.g. Next.js
// apps emit a <script id="__NEXT_DATA__" type="application/json"> tag, and
// many others use a similar `<script type="application/json">` or
// `window.SOME_NAME = {...}` pattern. Extracting all of these (rather than
// betting on one specific blob name, as the original realestate.com.au-only
// version of this file did) gives scrapers something more resilient to
// build on across different sites, without needing to know the exact
// variable name in advance.

function extractEmbeddedJsonBlobs(html) {
  if (!html) return [];
  const blobs = [];

  // <script id="__NEXT_DATA__" type="application/json">{...}</script>
  const nextDataMatch = html.match(
    /<script\s+id="__NEXT_DATA__"\s+type="application\/json">([\s\S]*?)<\/script>/
  );
  if (nextDataMatch) {
    tryPush(blobs, nextDataMatch[1]);
  }

  // Any other <script type="application/json">{...}</script> tags.
  const jsonScriptPattern = /<script[^>]+type="application\/json"[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = jsonScriptPattern.exec(html)) !== null) {
    tryPush(blobs, match[1]);
  }

  // window.SOME_NAME = {...}; assignments.
  const windowAssignmentPattern = /window\.[A-Za-z0-9_]+\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|window\.)/g;
  while ((match = windowAssignmentPattern.exec(html)) !== null) {
    tryPush(blobs, match[1]);
  }

  return blobs;
}

function tryPush(blobs, rawJson) {
  try {
    blobs.push(JSON.parse(rawJson));
  } catch (err) {
    // Not valid JSON on its own (e.g. a script tag with unrelated content) - skip it.
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
// "is a non-empty primitive"), searching across every extracted blob.
function findFirstByKeySubstring(blobs, substrings, valueCheck = defaultValueCheck) {
  const lowerSubstrings = substrings.map((s) => s.toLowerCase());
  for (const blob of blobs) {
    const matches = deepFindValues(
      blob,
      (key, value) =>
        lowerSubstrings.some((s) => key.toLowerCase().includes(s)) && valueCheck(value),
      { maxResults: 5 }
    );
    if (matches.length > 0) return matches[0].value;
  }
  return undefined;
}

function defaultValueCheck(value) {
  return (
    (typeof value === 'string' && value.trim().length > 0) ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

// Fallback for when no embedded JSON blob has the expected keys: pull a
// dollar figure out of the raw page text near a given anchor phrase (e.g.
// "estimate" or "median").
function extractDollarNearText(text, anchorPhrase, windowChars = 200) {
  if (!text) return undefined;
  const anchorIndex = text.toLowerCase().indexOf(anchorPhrase.toLowerCase());
  const searchText =
    anchorIndex === -1 ? text : text.slice(Math.max(0, anchorIndex - windowChars), anchorIndex + windowChars);
  const match = searchText.match(/\$[\d,]+(?:k|K|m|M)?/);
  return match ? match[0] : undefined;
}

module.exports = {
  extractEmbeddedJsonBlobs,
  deepFindValues,
  findFirstByKeySubstring,
  extractDollarNearText,
};
