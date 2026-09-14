const fs = require("fs");
const path = require("path");
const { keywordFilter, getCaseText } = require("./keywordFilter");
const { normalizedFilter } = require("./normalizedFilter");
const { classifierFilter } = require("./classifier");
const { pingModel, getConfiguredModel } = require("./modelClient");

const CASES_PATH = path.join(__dirname, "..", "cases.json");
const RESULTS_PATH = path.join(__dirname, "..", "results.json");

function score(cases, predictions) {
  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;
  const falseNegatives = [];
  const falsePositives = [];
  const truePositives = [];
  const trueNegatives = [];

  cases.forEach((c, i) => {
    const flagged = Boolean(predictions[i].flagged);
    const malicious = Boolean(c.malicious);
    if (malicious && flagged) {
      tp += 1;
      truePositives.push(c.id);
    } else if (malicious && !flagged) {
      fn += 1;
      falseNegatives.push(c.id);
    } else if (!malicious && flagged) {
      fp += 1;
      falsePositives.push(c.id);
    } else {
      tn += 1;
      trueNegatives.push(c.id);
    }
  });

  const detectionRate = tp + fn === 0 ? 0 : (tp / (tp + fn)) * 100;
  const falsePositiveRate = fp + tn === 0 ? 0 : (fp / (fp + tn)) * 100;
  return {
    tp,
    fn,
    fp,
    tn,
    detection_rate_pct: Number(detectionRate.toFixed(2)),
    false_positive_rate_pct: Number(falsePositiveRate.toFixed(2)),
    missed_case_ids: falseNegatives,
    wrongly_flagged_case_ids: falsePositives,
    true_positive_ids: truePositives,
    true_negative_ids: trueNegatives,
  };
}

function printTable(summaries) {
  const header = [
    "approach".padEnd(28),
    "TP".padStart(4),
    "FN".padStart(4),
    "FP".padStart(4),
    "TN".padStart(4),
    "detect%".padStart(9),
    "FP%".padStart(8),
  ].join("  ");
  console.log(header);
  console.log("-".repeat(header.length));
  for (const row of summaries) {
    console.log(
      [
        String(row.name).padEnd(28),
        String(row.tp).padStart(4),
        String(row.fn).padStart(4),
        String(row.fp).padStart(4),
        String(row.tn).padStart(4),
        String(row.detection_rate_pct).padStart(9),
        String(row.false_positive_rate_pct).padStart(8),
      ].join("  ")
    );
  }
}

async function main() {
  const skipClassifier = process.argv.includes("--skip-classifier");
  const payload = JSON.parse(fs.readFileSync(CASES_PATH, "utf8"));
  const cases = payload.cases;
  if (cases.length < 40) {
    throw new Error(`Need at least 40 cases, found ${cases.length}`);
  }

  let modelInfo = getConfiguredModel();
  if (!skipClassifier) {
    modelInfo = await pingModel();
    console.log(`Classifier model: ${modelInfo.model}`);
  }

  const keywordPreds = [];
  const normalizedPreds = [];
  const classifierPreds = [];

  for (const c of cases) {
    const text = getCaseText(c);
    keywordPreds.push(keywordFilter(text));
    normalizedPreds.push(normalizedFilter(text));
    if (skipClassifier) {
      classifierPreds.push({
        flagged: false,
        approach: "llm_classifier",
        skipped: true,
      });
    } else {
      process.stdout.write(`classifier ${c.id}... `);
      const pred = await classifierFilter(text);
      classifierPreds.push(pred);
      console.log(pred.flagged ? "FLAG" : "ok");
    }
  }

  const approaches = [
    { name: "keyword_regex", preds: keywordPreds },
    { name: "normalized_keyword_regex", preds: normalizedPreds },
    { name: "llm_classifier", preds: classifierPreds },
  ];

  const perApproach = {};
  const tableRows = [];
  for (const a of approaches) {
    const s = score(cases, a.preds);
    perApproach[a.name] = {
      ...s,
      predictions: cases.map((c, i) => ({
        id: c.id,
        category: c.category,
        malicious: c.malicious,
        flagged: a.preds[i].flagged,
        detail: a.preds[i],
      })),
    };
    tableRows.push({ name: a.name, ...s });
  }

  const results = {
    generated_at: new Date().toISOString(),
    case_count: cases.length,
    malicious_count: cases.filter((c) => c.malicious).length,
    benign_count: cases.filter((c) => !c.malicious).length,
    classifier_model: modelInfo,
    approaches: perApproach,
    summary_table: tableRows,
  };

  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
  console.log("\nGuardrail comparison\n");
  printTable(tableRows);
  console.log(`\nWrote ${RESULTS_PATH}`);
  for (const row of tableRows) {
    console.log(`\n${row.name}`);
    console.log(`  missed (FN): ${row.missed_case_ids.join(", ") || "(none)"}`);
    console.log(`  wrong flags (FP): ${row.wrongly_flagged_case_ids.join(", ") || "(none)"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
