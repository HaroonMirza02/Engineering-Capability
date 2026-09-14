const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const TOOL_LOG = path.join(DATA_DIR, "tool_calls.log");
const SENT_EMAILS = path.join(DATA_DIR, "sent_emails.log");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function appendJsonl(file, record) {
  ensureDataDir();
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
}

function logToolCall(record) {
  appendJsonl(TOOL_LOG, record);
}

function logSentEmail(record) {
  appendJsonl(SENT_EMAILS, record);
}

function resetLogs() {
  ensureDataDir();
  fs.writeFileSync(TOOL_LOG, "");
  fs.writeFileSync(SENT_EMAILS, "");
}

module.exports = {
  DATA_DIR,
  TOOL_LOG,
  SENT_EMAILS,
  logToolCall,
  logSentEmail,
  resetLogs,
  ensureDataDir,
};
