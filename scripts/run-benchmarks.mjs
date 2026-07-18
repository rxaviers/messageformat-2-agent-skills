#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HARNESS_API_VERSION,
  loadHarness,
  validateDescription,
  validateExecutionResult,
  validatePreflight,
} from "./benchmark-harnesses/contract.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(root, "skills");
const runsRoot = join(root, "benchmarks", "runs");
const allowedRunId = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const allowedArtifactName = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const valuedOptions = new Set([
  "--harness",
  "--harness-option",
  "--inference",
  "--model",
  "--reasoning-effort",
  "--trials",
  "--run-id",
  "--skills",
  "--seed",
  "--timeout-ms",
]);

const usage = `Usage:
  node scripts/run-benchmarks.mjs --model=<model> [options]

Options:
  --harness=<name-or-path>        codex, process, or an adapter module path (default: codex)
  --harness-option=<key=value>    Repeatable adapter-specific option
  --inference=<key=value>         Repeatable inference setting
  --model=<model>                 Required model identifier
  --reasoning-effort=<effort>     Alias for --inference=reasoningEffort=<effort>
  --trials=<count>                Positive number of trials per eval (default: 1)
  --run-id=<id>                   Immutable output ID; letters, digits, ., _, and - only
  --skills=<name,name>            Skills to run (default: every skill with evals/evals.json)
  --seed=<seed>                   Seed for deterministic arm ordering (default: run ID)
  --timeout-ms=<milliseconds>     Per-call timeout (default: 300000)
  --keep-traces                   Preserve adapter-provided traces
  --allow-unverified-isolation    Permit diagnostic runs from adapters that cannot verify isolation
  --dry-run                       Validate and print the execution plan without model calls
  --help                          Show this help
`;

function parseScalar(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function assignKeyValue(target, value, option) {
  const separator = value.indexOf("=");
  if (separator < 1) throw new Error(`${option} expects key=value`);
  const key = value.slice(0, separator);
  if (Object.hasOwn(target, key)) throw new Error(`${option} repeats key ${key}`);
  target[key] = parseScalar(value.slice(separator + 1));
}

function parseArgs(argv) {
  const options = {
    harness: "codex",
    harnessOptions: {},
    inference: {},
    trials: 1,
    timeoutMs: 300_000,
    keepTraces: false,
    allowUnverifiedIsolation: false,
    dryRun: false,
  };

  for (const arg of argv) {
    if (arg === "--help") options.help = true;
    else if (arg === "--keep-traces") options.keepTraces = true;
    else if (arg === "--allow-unverified-isolation") options.allowUnverifiedIsolation = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else {
      const separator = arg.indexOf("=");
      if (separator < 0) throw new Error(`Expected --name=value, received: ${arg}`);
      const key = arg.slice(0, separator);
      const value = arg.slice(separator + 1);
      if (!valuedOptions.has(key)) throw new Error(`Unknown option: ${key}`);
      if (!value) throw new Error(`${key} requires a value`);
      if (key === "--harness") options.harness = value;
      if (key === "--harness-option") assignKeyValue(options.harnessOptions, value, key);
      if (key === "--inference") assignKeyValue(options.inference, value, key);
      if (key === "--model") options.model = value;
      if (key === "--reasoning-effort") options.reasoningEffort = value;
      if (key === "--trials") options.trials = Number(value);
      if (key === "--run-id") options.runId = value;
      if (key === "--skills") options.skillNames = value.split(",").filter(Boolean);
      if (key === "--seed") options.seed = value;
      if (key === "--timeout-ms") options.timeoutMs = Number(value);
    }
  }

  if (options.reasoningEffort !== undefined) {
    if (Object.hasOwn(options.inference, "reasoningEffort")) {
      throw new Error("Use either --reasoning-effort or --inference=reasoningEffort=..., not both");
    }
    options.inference.reasoningEffort = options.reasoningEffort;
  } else if (options.harness === "codex" && !Object.hasOwn(options.inference, "reasoningEffort")) {
    options.inference.reasoningEffort = "medium";
  }
  delete options.reasoningEffort;
  return options;
}

function slug(value) {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function hashFile(path) {
  return sha256(readFileSync(path));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function commandOutput(command, args) {
  return execFileSync(command, args, { cwd: root, encoding: "utf8" }).trim();
}

function discoverSkills() {
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(skillsRoot, name, "evals", "evals.json")))
    .sort();
}

function ensureInside(parent, path, label) {
  const pathFromParent = relative(parent, path);
  if (pathFromParent === "" || (!pathFromParent.startsWith("..") && !isAbsolute(pathFromParent))) return;
  throw new Error(`${label} resolves outside ${parent}`);
}

function validateEvalFile(skillName, evals) {
  if (evals.skill_name !== skillName || !Array.isArray(evals.evals) || evals.evals.length === 0) {
    throw new Error(`${skillName}: invalid evals/evals.json`);
  }
  const ids = new Set();
  for (const evalCase of evals.evals) {
    if (!Number.isInteger(evalCase.id) || ids.has(evalCase.id)) {
      throw new Error(`${skillName}: eval IDs must be unique integers`);
    }
    if (typeof evalCase.prompt !== "string" || evalCase.prompt.length === 0) {
      throw new Error(`${skillName} eval ${evalCase.id}: prompt must be a non-empty string`);
    }
    if (evalCase.files !== undefined && !Array.isArray(evalCase.files)) {
      throw new Error(`${skillName} eval ${evalCase.id}: files must be an array`);
    }
    ids.add(evalCase.id);
  }
}

function copySkillWithoutEvals(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.name === "evals") continue;
    cpSync(join(source, entry.name), join(destination, entry.name), { recursive: true });
  }
}

function copyInputFiles(skillRoot, evalCase, workspace) {
  const copied = [];
  for (const file of evalCase.files ?? []) {
    if (typeof file !== "string" || file.length === 0 || isAbsolute(file)) {
      throw new Error(`Eval ${evalCase.id}: input file paths must be non-empty and relative`);
    }
    const source = resolve(skillRoot, file);
    ensureInside(skillRoot, source, `Eval ${evalCase.id} input ${file}`);
    if (!existsSync(source)) throw new Error(`Eval ${evalCase.id}: missing input file ${file}`);
    const destination = resolve(workspace, "inputs", file);
    ensureInside(join(workspace, "inputs"), destination, `Eval ${evalCase.id} input destination ${file}`);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { recursive: statSync(source).isDirectory() });
    copied.push(destination);
  }
  return copied;
}

function armOrder(seed, skillName, trial, evalId) {
  const byte = createHash("sha256").update(`${seed}:${skillName}:${trial}:${evalId}`).digest()[0];
  return byte % 2 === 0 ? ["without_skill", "with_skill"] : ["with_skill", "without_skill"];
}

function recordTraces(outputDir, traces) {
  for (const [name, content] of Object.entries(traces)) {
    if (!allowedArtifactName.test(name) || typeof content !== "string") {
      throw new Error(`Harness returned an unsafe trace artifact: ${name}`);
    }
    writeFileSync(join(outputDir, name), content, "utf8");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage);
    return;
  }
  if (!options.model) throw new Error("--model is required");
  if (!Number.isInteger(options.trials) || options.trials < 1) {
    throw new Error("--trials must be a positive integer");
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1) {
    throw new Error("--timeout-ms must be a positive integer");
  }

  const profile = options.inference.reasoningEffort ?? slug(options.harness);
  const defaultRunId = `${new Date().toISOString().slice(0, 10)}-${slug(options.model)}-${slug(String(profile))}`;
  const runId = options.runId ?? defaultRunId;
  if (!allowedRunId.test(runId)) throw new Error(`Unsafe --run-id: ${runId}`);
  const runDir = resolve(runsRoot, runId);
  ensureInside(runsRoot, runDir, "Run directory");
  if (existsSync(runDir)) throw new Error(`Benchmark run already exists: ${runId}`);

  const discoveredSkills = discoverSkills();
  const skillNames = options.skillNames ?? discoveredSkills;
  if (skillNames.length === 0) throw new Error("No skills with evals/evals.json were found");
  if (new Set(skillNames).size !== skillNames.length) throw new Error("--skills must not contain duplicates");
  for (const skillName of skillNames) {
    if (!discoveredSkills.includes(skillName)) throw new Error(`Unknown or unevaluated skill: ${skillName}`);
  }

  const skillCommit = commandOutput("git", ["rev-parse", "HEAD"]);
  const dirtySources = commandOutput("git", ["status", "--porcelain", "--", ...skillNames.map((name) => `skills/${name}`)]);
  if (dirtySources) throw new Error(`Commit skill and eval changes before benchmarking:\n${dirtySources}`);

  const skills = skillNames.map((skillName) => {
    const skillRoot = join(skillsRoot, skillName);
    const skillPath = join(skillRoot, "SKILL.md");
    const evalsPath = join(skillRoot, "evals", "evals.json");
    const evals = JSON.parse(readFileSync(evalsPath, "utf8"));
    validateEvalFile(skillName, evals);
    return {
      name: skillName,
      root: skillRoot,
      evals,
      manifest: {
        name: skillName,
        skill_path: `skills/${skillName}/SKILL.md`,
        skill_sha256: hashFile(skillPath),
        evals_path: `skills/${skillName}/evals/evals.json`,
        evals_sha256: hashFile(evalsPath),
      },
    };
  });

  const harness = await loadHarness(options.harness, root);
  const harnessContext = {
    root,
    model: options.model,
    inference: options.inference,
    options: options.harnessOptions,
    targetSkillNames: skillNames,
  };
  const description = validateDescription(await harness.module.describe(harnessContext));
  const preflight = validatePreflight(
    await harness.module.preflight(harnessContext),
    options.allowUnverifiedIsolation,
  );

  const seed = options.seed ?? runId;
  const plan = skills.flatMap((skill) => Array.from({ length: options.trials }, (_, trialIndex) => {
    const trial = trialIndex + 1;
    return skill.evals.evals.flatMap((evalCase) => armOrder(seed, skill.name, trial, evalCase.id).map((condition, order) => ({
      skill,
      evalCase,
      condition,
      trial,
      pairOrder: order + 1,
    })));
  })).flat();

  if (options.dryRun) {
    console.log(JSON.stringify({
      run_id: runId,
      harness: {
        name: description.name,
        version: description.version,
        adapter: harness.recordedPath,
        isolation: preflight.isolation,
        warnings: preflight.warnings,
      },
      model: {
        requested: options.model,
        resolved: preflight.resolvedModel,
        inference: options.inference,
      },
      trials_per_eval: options.trials,
      seed,
      keep_traces: options.keepTraces,
      calls: plan.map(({ skill, evalCase, condition, trial, pairOrder }) => ({
        skill: skill.name,
        eval_id: evalCase.id,
        trial,
        condition,
        pair_order: pairOrder,
      })),
    }, null, 2));
    return;
  }

  mkdirSync(runsRoot, { recursive: true });
  const tempRoot = mkdtempSync(join(tmpdir(), "mf2-benchmark-workspaces-"));
  let stagingDir = mkdtempSync(join(runsRoot, ".staging-"));
  const startedAt = new Date().toISOString();
  const usageRecords = [];
  const resolvedModels = new Set(preflight.resolvedModel ? [preflight.resolvedModel] : []);
  const executionWarnings = [...preflight.warnings];

  try {
    for (let index = 0; index < plan.length; index += 1) {
      const { skill, evalCase, condition, trial, pairOrder } = plan[index];
      const directoryArm = condition.replace("_", "-");
      const caseId = `${skill.name}/trial-${String(trial).padStart(2, "0")}/eval-${evalCase.id}/${directoryArm}`;
      const workspace = join(tempRoot, "workspaces", caseId);
      const runtimeDir = join(tempRoot, "runtime", caseId);
      const outputDir = join(stagingDir, caseId);
      mkdirSync(workspace, { recursive: true });
      mkdirSync(runtimeDir, { recursive: true });
      mkdirSync(outputDir, { recursive: true });

      const inputFiles = copyInputFiles(skill.root, evalCase, workspace);
      let skillPath = null;
      if (condition === "with_skill") {
        const snapshotRoot = join(workspace, "skill", skill.name);
        copySkillWithoutEvals(skill.root, snapshotRoot);
        skillPath = join(snapshotRoot, "SKILL.md");
      }

      console.log(`[${index + 1}/${plan.length}] ${skill.name} eval ${evalCase.id} trial ${trial} ${condition}`);
      const result = validateExecutionResult(await harness.module.execute({
        root,
        options: options.harnessOptions,
        condition,
        task: evalCase.prompt,
        skillPath,
        inputFiles,
        workspace,
        runtimeDir,
        model: options.model,
        inference: options.inference,
        timeoutMs: options.timeoutMs,
        keepTraces: options.keepTraces,
      }));

      writeFileSync(join(outputDir, "response.md"), result.response, "utf8");
      writeJson(join(outputDir, "timing.json"), {
        harness: { name: description.name, version: description.version },
        model: {
          requested: options.model,
          resolved: result.resolvedModel,
          inference: options.inference,
        },
        duration_ms: result.durationMs,
        usage: result.usage,
        execution_index: index + 1,
        pair_order: pairOrder,
      });
      if (options.keepTraces) recordTraces(outputDir, result.traces);
      if (result.resolvedModel) resolvedModels.add(result.resolvedModel);
      executionWarnings.push(...result.warnings.map((warning) => `${caseId}: ${warning}`));
      usageRecords.push({
        skill: skill.name,
        eval_id: evalCase.id,
        trial,
        condition,
        execution_index: index + 1,
        pair_order: pairOrder,
        duration_ms: result.durationMs,
        usage: result.usage,
      });
    }

    const resolvedModel = resolvedModels.size === 1 ? [...resolvedModels][0] : null;
    const completedAt = new Date().toISOString();
    const harnessRecord = {
      api_version: HARNESS_API_VERSION,
      name: description.name,
      version: description.version,
      adapter: harness.recordedPath,
      adapter_sha256: harness.sha256,
      capabilities: description.capabilities,
      configuration: description.configuration,
      isolation: preflight.isolation,
    };
    const modelRecord = {
      requested: options.model,
      resolved: resolvedModel,
      inference: options.inference,
    };

    writeJson(join(stagingDir, "runner.json"), {
      script: "scripts/run-benchmarks.mjs",
      script_sha256: hashFile(fileURLToPath(import.meta.url)),
      harness: harnessRecord,
      model: modelRecord,
      trials_per_eval: options.trials,
      seed,
      timeout_ms: options.timeoutMs,
      keep_traces: options.keepTraces,
      workspace: "separate temporary workspace per call",
      started_at: startedAt,
      completed_at: completedAt,
      warnings: executionWarnings,
    });
    writeJson(join(stagingDir, "run-inputs.json"), {
      skills: skills.map((skill) => ({
        ...skill.manifest,
        eval_ids: skill.evals.evals.map((item) => item.id),
        input_files: skill.evals.evals.flatMap((item) => item.files ?? []),
      })),
      execution_order: usageRecords.map(({ usage, duration_ms: durationMs, ...record }) => ({ ...record, duration_ms: durationMs })),
      usage_records: usageRecords,
    });
    writeJson(join(stagingDir, "manifest.json"), {
      schema_version: 3,
      run_id: runId,
      status: "outputs_captured_pending_grading",
      classification: !preflight.isolation.verified
        ? "diagnostic"
        : options.trials >= 5 ? "reliability" : "exploratory",
      started_on: startedAt.slice(0, 10),
      harness: harnessRecord,
      model: modelRecord,
      grader: null,
      skill_commit: skillCommit,
      trials_per_eval: options.trials,
      conditions: ["with_skill", "without_skill"],
      telemetry: {
        tokens: "captured per arm and eval in timing.json",
        duration_ms: "captured per arm and eval in timing.json",
      },
      traces: options.keepTraces ? "captured" : "not_captured",
      skills: skills.map((skill) => skill.manifest),
      limitations: [
        "Outputs have not yet been graded.",
        ...(options.trials < 5 ? ["Fewer than five trials were run per eval and condition."] : []),
        ...(!preflight.isolation.verified ? ["The harness did not verify baseline skill isolation."] : []),
        ...(resolvedModels.size > 1 ? ["The harness reported multiple resolved model identifiers."] : []),
      ],
    });

    renameSync(stagingDir, runDir);
    stagingDir = null;
    console.log(`Captured ${plan.length} eval calls in ${runDir}`);
    console.log("Next: grade assertions, write benchmark.json and report.md, then set manifest.status to complete.");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    if (stagingDir) rmSync(stagingDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`ERROR ${error.message}`);
  process.exitCode = 1;
});
