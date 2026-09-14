const HOMOGLYPHS = new Map([
  ["а", "a"],
  ["е", "e"],
  ["о", "o"],
  ["р", "p"],
  ["с", "c"],
  ["у", "y"],
  ["х", "x"],
  ["і", "i"],
  ["ї", "i"],
  ["ё", "e"],
  ["А", "a"],
  ["Е", "e"],
  ["О", "o"],
  ["Р", "p"],
  ["С", "c"],
  ["І", "i"],
  ["０", "0"],
  ["１", "1"],
  ["３", "3"],
  ["４", "4"],
  ["５", "5"],
  ["７", "7"],
]);

const LEET = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
};

function mapHomoglyphs(s) {
  let out = "";
  for (const ch of s) {
    out += HOMOGLYPHS.get(ch) || ch;
  }
  return out;
}

function stripZeroWidth(s) {
  return s.replace(/[\u200b\u200c\u200d\ufeff\u2060]/g, "");
}

function collapseLetterSpaces(s) {
  // "i g n o r e" -> "ignore" when tokens are mostly single letters
  return s.replace(/(?:^|[\s])(?:[A-Za-z]\s+){3,}[A-Za-z](?=[\s.,]|$)/g, (chunk) =>
    chunk.replace(/\s+/g, "")
  );
}

function looksLikeBase64(s) {
  const t = s.replace(/\s+/g, "");
  if (t.length < 24 || t.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(t);
}

function looksLikeHex(s) {
  const t = s.replace(/\s+/g, "");
  return t.length >= 32 && t.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(t);
}

function rot13(s) {
  return s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function tryDecodeChunk(chunk) {
  const trimmed = chunk.trim();
  const compact = trimmed.replace(/\s+/g, "");
  const decoded = [];
  if (looksLikeBase64(compact)) {
    try {
      const buf = Buffer.from(compact, "base64");
      const asText = buf.toString("utf8");
      if (/^[\x09\x0a\x0d\x20-\x7e]+$/.test(asText)) decoded.push(asText);
    } catch {
      /* ignore */
    }
  }
  if (looksLikeHex(compact)) {
    try {
      const asText = Buffer.from(compact, "hex").toString("utf8");
      if (/^[\x09\x0a\x0d\x20-\x7e]+$/.test(asText)) decoded.push(asText);
    } catch {
      /* ignore */
    }
  }
  return decoded;
}

function extractCandidateChunks(text) {
  const chunks = [text];
  const tokens = text.split(/\s+/);
  for (const tok of tokens) {
    if (tok.length >= 24) chunks.push(tok);
  }
  const base64Runs = text.match(/[A-Za-z0-9+/]{24,}={0,2}/g) || [];
  const hexRuns = text.match(/\b[0-9a-fA-F]{32,}\b/g) || [];
  chunks.push(...base64Runs, ...hexRuns);
  return chunks;
}

function normalizeForFilter(raw) {
  const original = String(raw || "");
  let text = original.normalize("NFKC");
  text = stripZeroWidth(text);
  text = mapHomoglyphs(text);

  const decodedBits = [];
  for (const chunk of extractCandidateChunks(text)) {
    decodedBits.push(...tryDecodeChunk(chunk));
  }
  const rot = rot13(text);

  const spaced = collapseLetterSpaces(text.toLowerCase());
  const leet = spaced.replace(/[013457]/g, (ch) => LEET[ch] || ch);
  const collapsed = leet.replace(/\s+/g, " ").trim();

  const extra = [...decodedBits, rot]
    .map((s) => s.toLowerCase())
    .join("\n");
  // Keep the original (lowercased) so hardening can only add decoded/deobfuscated signal.
  return `${original.toLowerCase()}\n${collapsed}\n${extra}`.trim();
}

module.exports = { normalizeForFilter, rot13 };
