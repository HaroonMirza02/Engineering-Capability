const { keywordFilter } = require("./keywordFilter");
const { normalizeForFilter } = require("./normalize");

function normalizedFilter(text) {
  const normalized = normalizeForFilter(text);
  const inner = keywordFilter(normalized);
  return {
    flagged: inner.flagged,
    approach: "normalized_keyword_regex",
    matches: inner.matches,
    normalizedPreview: normalized.slice(0, 240),
  };
}

module.exports = { normalizedFilter };
