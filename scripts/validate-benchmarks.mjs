#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
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

for (const runId of readdirSync(runsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()) {
  const runDir = join(runsRoot, runId);
  const manifest = readJson(join(runDir, "manifest.json"));
  if (!manifest) continue;

  if (manifest.status && manifest.status !== "complete") {
    console.log(`Skipping pending benchmark ${runId} (${manifest.status}).`);
    continue;
  }

  if (manifest.run_id !== runId) {
    errors.push(`${runId}: manifest run_id does not match its directory`);
  }
  if (!Array.isArray(manifest.skills) || manifest.skills.length === 0) {
    errors.push(`${runId}: manifest must contain at least one skill`);
    continue;
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
