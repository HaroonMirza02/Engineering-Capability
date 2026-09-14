const fs = require("fs");
const path = require("path");

function loadNearbyEnv() {
  const candidates = [
    path.join(__dirname, "..", "..", "agent-service", ".env"),
    path.join(__dirname, "..", "..", ".env"),
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadNearbyEnv();

const DEFAULT_OLLAMA = process.env.OLLAMA_HOST || "http://127.0.0.1:11435";
const DEFAULT_MODEL = process.env.AGENT_MODEL || process.env.OLLAMA_MODEL || "llama3.2:3b";

async function ollamaChat({ messages, tools, format, options, timeoutMs = 180000 }) {
  const model = DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${DEFAULT_OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        tools: tools && tools.length ? tools : undefined,
        format,
        options: { temperature: 0, ...(options || {}) },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ollama HTTP ${res.status}: ${body.slice(0, 500)}`);
    }
    const data = await res.json();
    return { provider: "ollama", model, ...data };
  } finally {
    clearTimeout(timer);
  }
}

async function pingModel() {
  const res = await fetch(`${DEFAULT_OLLAMA}/api/show`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: DEFAULT_MODEL, model: DEFAULT_MODEL }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Model ${DEFAULT_MODEL} not available: ${body.slice(0, 300)}`);
  }
  const info = await res.json();
  return {
    provider: "ollama",
    model: DEFAULT_MODEL,
    details: info.details || {},
    modified_at: info.modified_at,
  };
}

function getConfiguredModel() {
  return { provider: "ollama", model: DEFAULT_MODEL, host: DEFAULT_OLLAMA };
}

module.exports = { ollamaChat, pingModel, getConfiguredModel, DEFAULT_MODEL, DEFAULT_OLLAMA };
