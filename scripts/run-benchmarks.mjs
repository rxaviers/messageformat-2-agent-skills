#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = process.cwd();
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.split("=", 2);
  return [key, value ?? true];
}));
const model = args.get("--model") || "gpt-5.6-luna";
const reasoning = args.get("--reasoning-effort") || "medium";
const trials = Number(args.get("--trials") || 1);
const runId = args.get("--run-id") || `${new Date().toISOString().slice(0, 10)}-${model}-${reasoning}`;

if (!Number.isInteger(trials) || trials < 1) throw new Error("--trials must be a positive integer");

const skillNames = ["messageformat-2-syntax", "messageformat-2-resource-syntax"];
const runDir = resolve(root, "benchmarks", "runs", runId);
const workspace = mkdtempSync(join(tmpdir(), "mf2-benchmark-"));
cpSync(join(root, "skills"), join(workspace, "skills"), { recursive: true });
mkdirSync(runDir, { recursive: true });

function gitHash(path) {
  return execFileSync("shasum", ["-a", "256", path], { encoding: "utf8" }).split(/\s+/)[0];
}

function runCase(skillName, evalCase, arm, trial) {
  const directoryArm = arm === "with_skill" ? "with-skill" : "without-skill";
  const outputDir = join(runDir, skillName, `trial-${String(trial).padStart(2, "0")}`, `eval-${evalCase.id}`, directoryArm);
  mkdirSync(outputDir, { recursive: true });
  const responsePath = join(outputDir, "response.md");
  const skillPath = join(workspace, "skills", skillName, "SKILL.md");
  const instruction = arm === "with_skill"
    ? `Use the skill at ${skillPath} to solve this user request. Read the skill and any references it directs you to. Do not inspect eval definitions or prior benchmark outputs.`
    : "Solve this user request directly. Do not use or inspect any skill, eval definition, or prior benchmark output.";
  const prompt = `${instruction}\n\nUser request:\n${evalCase.prompt}`;
  const started = Date.now();
  const result = spawnSync("codex", [
    "-a", "never", "exec",
    "--model", model,
    "--config", `model_reasoning_effort=\"${reasoning}\"`,
    "--sandbox", "read-only",
    "--ephemeral",
    "--skip-git-repo-check",
    "--json",
    "--cd", workspace,
    "--output-last-message", responsePath,
    prompt,
  ], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  const duration = Date.now() - started;
  writeFileSync(join(outputDir, "events.jsonl"), result.stdout || "", "utf8");
  writeFileSync(join(outputDir, "stderr.log"), result.stderr || "", "utf8");
  const events = (result.stdout || "").split("\n").flatMap((line) => {
    try { return line.trim() ? [JSON.parse(line)] : []; } catch { return []; }
  });
  const completed = events.find((event) => event.type === "turn.completed");
  writeFileSync(join(outputDir, "timing.json"), JSON.stringify({
    model,
    reasoning_effort: reasoning,
    duration_ms: duration,
    exit_code: result.status,
    usage: completed?.usage ?? "not_captured",
  }, null, 2) + "\n", "utf8");
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${skillName} eval ${evalCase.id} ${arm} exited ${result.status}`);
  return completed?.usage ?? null;
}

const skills = [];
for (const skillName of skillNames) {
  const evalsPath = join(root, "skills", skillName, "evals", "evals.json");
  const evals = JSON.parse(readFileSync(evalsPath, "utf8"));
  const usages = [];
  for (let trial = 1; trial <= trials; trial += 1) {
    for (const evalCase of evals.evals) {
      for (const arm of ["without_skill", "with_skill"]) {
        usages.push(runCase(skillName, evalCase, arm, trial));
      }
    }
  }
  skills.push({
    name: skillName,
    skill_path: `skills/${skillName}/SKILL.md`,
    skill_sha256: gitHash(join(root, "skills", skillName, "SKILL.md")),
    evals_path: `skills/${skillName}/evals/evals.json`,
    evals_sha256: gitHash(evalsPath),
    eval_ids: evals.evals.map((item) => item.id),
    usage_records: usages.length,
  });
}

writeFileSync(join(runDir, "runner.json"), JSON.stringify({
  model,
  reasoning_effort: reasoning,
  trials_per_eval: trials,
  workspace,
  completed_at: new Date().toISOString(),
}, null, 2) + "\n", "utf8");
writeFileSync(join(runDir, "run-inputs.json"), JSON.stringify({ skills }, null, 2) + "\n", "utf8");
console.log(`Completed ${skills.reduce((sum, skill) => sum + skill.eval_ids.length * 2 * trials, 0)} paired eval calls in ${runDir}`);
