/**
 * Approach 1: first-pass keyword / regex filter.
 * Intentionally naive — the kind of list a team ships in a week.
 */

const PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /disregard\s+(your\s+)?(system\s+)?(prompt|instructions|rules)/i,
  /forget\s+(everything|your\s+rules|all\s+(previous|prior))/i,
  /override\s+(your\s+)?(safety|rules|guardrails|system)/i,
  /new\s+instructions\s+replace/i,
  /\byou\s+are\s+now\b/i,
  /\byou\s+are\s+DAN\b/i,
  /\bjailbreak\b/i,
  /developer\s+mode/i,
  /reveal\s+(your\s+)?(hidden\s+|secret\s+)?(system\s+)?(prompt|instructions|rules)/i,
  /print\s+your\s+hidden\s+system\s+rules/i,
  /confirm_action\s*=\s*true/i,
  /send_email\s+to\s+\S+@\S+/i,
  /do\s+not\s+(answer|summarize)/i,
  /this\s+html\s+comment\s+is\s+an\s+internal\s+directive/i,
  /x-agent-instruction/i,
  /assistant_directive/i,
  /internal_only_parser_hint/i,
  /stay\s+in\s+character/i,
  /as\s+DAN\b/i,
  /break-glass/i,
];

function getCaseText(testCase) {
  if (Array.isArray(testCase.turns) && testCase.turns.length) {
    return testCase.turns.join("\n");
  }
  return testCase.text || "";
}

function keywordFilter(text) {
  const haystack = String(text || "");
  const hits = [];
  for (const re of PATTERNS) {
    const m = haystack.match(re);
    if (m) hits.push(m[0]);
  }
  return {
    flagged: hits.length > 0,
    approach: "keyword_regex",
    matches: hits,
  };
}

module.exports = { keywordFilter, getCaseText, PATTERNS };
