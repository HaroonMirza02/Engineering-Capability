const { MongoClient } = require("mongodb");

let client;
let db;
let memoryServer;

function loadEnvFile() {
  const fs = require("fs");
  const path = require("path");
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
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

loadEnvFile();

async function getDb() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (uri) {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db();
    return db;
  }
  const { MongoMemoryServer } = require("mongodb-memory-server");
  memoryServer = await MongoMemoryServer.create();
  client = new MongoClient(memoryServer.getUri());
  await client.connect();
  db = client.db("agentic_validation");
  console.log("Using mongodb-memory-server (no MONGODB_URI set)");
  return db;
}

async function closeDb() {
  if (client) await client.close();
  if (memoryServer) await memoryServer.stop();
  client = undefined;
  db = undefined;
  memoryServer = undefined;
}

module.exports = { getDb, closeDb, loadEnvFile };
