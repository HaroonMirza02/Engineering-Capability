const express = require("express");
const { getDb } = require("./db");
const { seed } = require("./seed");
const { runAgent, pingModel } = require("./agent");
const { ensureDataDir } = require("./log");

const PORT = Number(process.env.PORT || 3847);

async function createApp() {
  ensureDataDir();
  await getDb();
  await seed();
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", async (_req, res) => {
    try {
      const model = await pingModel();
      res.json({ ok: true, model });
    } catch (err) {
      res.status(503).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.post("/v1/chat", async (req, res) => {
    try {
      const customerId = String(req.body.customerId || "").trim();
      const message = String(req.body.message || "").trim();
      const humanApproved = Boolean(req.body.humanApproved);
      if (!customerId || !message) {
        res.status(400).json({ error: "customerId and message are required" });
        return;
      }
      const result = await runAgent({
        userText: message,
        customerId,
        humanApproved,
        conversationId: req.body.conversationId,
        caseId: req.body.caseId,
      });
      res.json({
        conversationId: result.conversationId,
        model: result.model,
        text: result.finalText,
        toolTrace: result.toolTrace,
      });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  return app;
}

if (require.main === module) {
  createApp()
    .then((app) => {
      app.listen(PORT, () => {
        console.log(`agent-service listening on ${PORT}`);
      });
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { createApp };
