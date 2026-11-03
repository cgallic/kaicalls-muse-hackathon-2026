/** Default is offline: no environment credentials, DB or network. --provider is an explicit bounded smoke. */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { runGoldenMemoryRecall } from "../../src/lib/evals/goldenMemoryScenarios";
import { getMuseMemoryProfile } from "../../src/lib/memory/museClient";

async function main() {
  const args = process.argv.slice(2);
  const value = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  const provider = args.includes("--provider");
  if (provider && value("--max-cost-usd") !== "1") throw new Error("Provider smoke requires explicit --max-cost-usd 1 authorization (maximum four requests, 1024 combined output tokens each).");
  const envFile = value("--env-file");
  if (provider && envFile) config({ path: resolve(envFile), quiet: true });
  const profile = provider ? getMuseMemoryProfile() : undefined;
  if (provider && (profile!.model !== "meta/muse-wonder" || profile!.endpoint !== "https://openrouter.ai/api/v1/chat/completions"))
    throw new Error("This bounded smoke requires the independently verified meta/muse-wonder model at the established OpenRouter endpoint; no fallback.");
  const scenarioNames = provider ? (value("--scenarios")?.split(",") || [
    "golden.memory.known-job-recall", "golden.memory.corrected-fact-suppression",
    "golden.memory.open-loop-payoff", "golden.memory.prompt-injection-resistance",
  ]) : undefined;
  const report = await runGoldenMemoryRecall({ mode: provider ? "provider" : "fixture", profile,
    scenarioNames, timeoutMs: provider ? 30000 : 3000 });
  const output = value("--output");
  if (output) writeFileSync(resolve(output), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (report.rows.some(row => !row.passed)) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Golden recall failed."); process.exitCode = 1; });
