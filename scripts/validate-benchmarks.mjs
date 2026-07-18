#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runsRoot = join(root, "benchmarks", "runs");
const errors = [];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${path}: ${error.message}`);
    return null;
  }
}

function hashAtCommit(commit, path) {
  return createHash("sha256").update(readAtCommit(commit, path)).digest("hex");
}

function readAtCommit(commit, path) {
  return execFileSync("git", ["show", `${commit}:${path}`], {
    cwd: root,
    encoding: null,
  });
}

function requireFile(path) {
  if (!existsSync(path)) errors.push(`${path}: missing`);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameRequestedModel(left, right) {
  if (typeof left === "string" || typeof right === "string") return left === right;
  return left?.requested === right?.requested && sameJson(left?.inference, right?.inference);
}

for (const runId of readdirSync(runsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
  .map((entry) => entry.name)
  .sort()) {
  const runDir = join(runsRoot, runId);
  const manifest = readJson(join(runDir, "manifest.json"));
  if (!manifest) continue;

  const status = manifest.status ?? "complete";
  const allowedStatuses = new Set(["complete", "outputs_captured_pending_grading", "invalid"]);
  if (!allowedStatuses.has(status)) {
    errors.push(`${runId}: unknown manifest status ${status}`);
    continue;
  }
  if (status === "invalid") {
    console.log(`Skipping invalid benchmark ${runId}.`);
    continue;
  }
  const pendingCapture = status === "outputs_captured_pending_grading";
  if (pendingCapture && ![2, 3].includes(manifest.schema_version)) {
    console.log(`Skipping legacy pending benchmark ${runId}.`);
    continue;
  }

  if (manifest.run_id !== runId) {
    errors.push(`${runId}: manifest run_id does not match its directory`);
  }
  if (!Array.isArray(manifest.skills) || manifest.skills.length === 0) {
    errors.push(`${runId}: manifest must contain at least one skill`);
    continue;
  }
  if (pendingCapture) {
    const runner = readJson(join(runDir, "runner.json"));
    const inputs = readJson(join(runDir, "run-inputs.json"));
    if (runner && manifest.schema_version === 2 && (runner.model !== manifest.model || runner.reasoning_effort !== manifest.reasoning_effort)) {
      errors.push(`${runId}: runner model settings do not match the manifest`);
    }
    if (runner && manifest.schema_version === 3 && !sameJson(runner.model, manifest.model)) {
      errors.push(`${runId}: runner model settings do not match the manifest`);
    }
    if (runner && manifest.schema_version === 3 && !sameJson(runner.harness, manifest.harness)) {
      errors.push(`${runId}: runner harness does not match the manifest`);
    }
    if (manifest.schema_version === 3 && manifest.classification !== "diagnostic" && manifest.harness?.isolation?.verified !== true) {
      errors.push(`${runId}: non-diagnostic benchmark lacks verified harness isolation`);
    }
    if (runner && runner.trials_per_eval !== manifest.trials_per_eval) {
      errors.push(`${runId}: runner trial count does not match the manifest`);
    }
    if (inputs && !Array.isArray(inputs.execution_order)) {
      errors.push(`${runId}: run-inputs.json is missing execution_order`);
    }
  }

  for (const skill of manifest.skills) {
    let evalsById = new Map();
    for (const [path, expected] of [
      [skill.skill_path, skill.skill_sha256],
      [skill.evals_path, skill.evals_sha256],
    ]) {
      try {
        const actual = hashAtCommit(manifest.skill_commit, path);
        if (actual !== expected) {
          errors.push(`${runId}: ${path} hash does not match ${manifest.skill_commit}`);
        }
      } catch (error) {
        errors.push(`${runId}: cannot read ${path} at ${manifest.skill_commit}: ${error.message}`);
      }
    }
    try {
      const evals = JSON.parse(readAtCommit(manifest.skill_commit, skill.evals_path).toString("utf8"));
      evalsById = new Map(evals.evals.map((item) => [item.id, item]));
    } catch (error) {
      errors.push(`${runId}: cannot parse ${skill.evals_path}: ${error.message}`);
    }

    if (pendingCapture) {
      for (let trial = 1; trial <= manifest.trials_per_eval; trial += 1) {
        const trialId = `trial-${String(trial).padStart(2, "0")}`;
        for (const evalId of evalsById.keys()) {
          for (const directoryArm of ["with-skill", "without-skill"]) {
            const outputDir = join(runDir, skill.name, trialId, `eval-${evalId}`, directoryArm);
            const responsePath = join(outputDir, "response.md");
            requireFile(responsePath);
            if (existsSync(responsePath) && readFileSync(responsePath, "utf8").trim().length === 0) {
              errors.push(`${responsePath}: empty`);
            }
            const timing = readJson(join(outputDir, "timing.json"));
            if (timing && manifest.schema_version === 2 && timing.exit_code !== 0) {
              errors.push(`${outputDir}: timing.json records a failed call`);
            }
            if (timing && manifest.schema_version === 2 && (timing.model !== manifest.model || timing.reasoning_effort !== manifest.reasoning_effort)) {
              errors.push(`${outputDir}: timing model settings do not match the manifest`);
            }
            if (timing && manifest.schema_version === 3 && !sameRequestedModel(timing.model, manifest.model)) {
              errors.push(`${outputDir}: timing model settings do not match the manifest`);
            }
            if (timing && manifest.schema_version === 3 && (
              timing.harness?.name !== manifest.harness?.name || timing.harness?.version !== manifest.harness?.version
            )) {
              errors.push(`${outputDir}: timing harness does not match the manifest`);
            }
            if (timing && (!Number.isFinite(timing.duration_ms) || timing.duration_ms < 0)) {
              errors.push(`${outputDir}: timing.json has an invalid duration`);
            }
          }
        }
      }
      continue;
    }

    const skillDir = join(runDir, skill.name);
    const benchmark = readJson(join(skillDir, "benchmark.json"));
    const grading = readJson(join(skillDir, "grading.json"));
    requireFile(join(skillDir, "report.md"));
    if (!benchmark || !grading) continue;

    const gradesById = new Map(grading.results.map((item) => [item.eval_id, item]));
    for (const [evalId, definition] of evalsById) {
      const grade = gradesById.get(evalId);
      if (!grade || grade.assertions.length !== definition.assertions.length) {
        errors.push(`${runId}/${skill.name}: grading does not cover every assertion for eval ${evalId}`);
        continue;
      }
      grade.assertions.forEach((assertion, index) => {
        const category = definition.assertions[index].match(/^\[([^\]]+)\]/)?.[1];
        if (assertion.index !== index + 1 || assertion.category !== category) {
          errors.push(`${runId}/${skill.name}: grading metadata differs from eval ${evalId} assertion ${index + 1}`);
        }
        for (const armName of ["with_skill", "without_skill"]) {
          const arm = assertion[armName];
          if (typeof arm?.passed !== "boolean" || typeof arm?.evidence !== "string" || arm.evidence.length === 0) {
            errors.push(`${runId}/${skill.name}: incomplete ${armName} grade for eval ${evalId} assertion ${index + 1}`);
          }
        }
      });
    }

    for (const armName of ["with_skill", "without_skill"]) {
      const arm = benchmark.arms?.[armName];
      if (!arm) {
        errors.push(`${runId}/${skill.name}: missing ${armName} aggregate`);
        continue;
      }
      const passed = arm.per_eval.reduce((sum, item) => sum + item.passed, 0);
      const total = arm.per_eval.reduce((sum, item) => sum + item.total, 0);
      if (passed !== arm.passed || total !== arm.total) {
        errors.push(`${runId}/${skill.name}: ${armName} aggregate arithmetic is inconsistent`);
      }

      if (arm.per_eval.length !== evalsById.size) {
        errors.push(`${runId}/${skill.name}: ${armName} does not cover every eval`);
      }

      const categoryCounts = new Map();
      for (const grade of grading.results) {
        const item = arm.per_eval.find((candidate) => candidate.eval_id === grade.eval_id);
        const gradedPassed = grade.assertions.filter((assertion) => assertion[armName].passed).length;
        if (!item || item.passed !== gradedPassed || item.total !== grade.assertions.length) {
          errors.push(`${runId}/${skill.name}: ${armName} grading differs from eval ${grade.eval_id} aggregate`);
        }
        for (const assertion of grade.assertions) {
          const counts = categoryCounts.get(assertion.category) ?? { passed: 0, total: 0 };
          counts.total += 1;
          if (assertion[armName].passed) counts.passed += 1;
          categoryCounts.set(assertion.category, counts);
        }
      }
      if (arm.categories) {
        for (const [category, counts] of categoryCounts) {
          if (JSON.stringify(arm.categories[category]) !== JSON.stringify(counts)) {
            errors.push(`${runId}/${skill.name}: ${armName} ${category} category aggregate is inconsistent`);
          }
        }
      }

      for (let trial = 1; trial <= manifest.trials_per_eval; trial += 1) {
        const trialId = `trial-${String(trial).padStart(2, "0")}`;
        const directoryArm = armName.replace("_", "-");
        for (const item of arm.per_eval) {
          if (item.total !== evalsById.get(item.eval_id)?.assertions.length) {
            errors.push(`${runId}/${skill.name}: eval ${item.eval_id} total does not match evals.json`);
          }
          requireFile(join(skillDir, trialId, `eval-${item.eval_id}`, directoryArm, "response.md"));
        }
      }
    }

    const actualDelta = benchmark.arms.with_skill.pass_rate - benchmark.arms.without_skill.pass_rate;
    if (Math.abs(actualDelta - benchmark.delta.pass_rate) > 1e-12) {
      errors.push(`${runId}/${skill.name}: pass-rate delta is inconsistent`);
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exit(1);
}

console.log("Benchmark records are valid.");
