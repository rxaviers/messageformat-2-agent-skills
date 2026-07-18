import { spawnSync } from "node:child_process";

export const apiVersion = 1;

const reasoningEfforts = new Set(["low", "medium", "high", "xhigh", "max"]);

function executable(options) {
  const unknown = Object.keys(options).filter((key) => key !== "executable");
  if (unknown.length > 0) throw new Error(`Unsupported Claude harness option: ${unknown.join(", ")}`);
  const command = options.executable ?? "claude";
  if (typeof command !== "string" || command.length === 0) throw new Error("Claude executable must be a non-empty string");
  return command;
}

function failure(result, operation) {
  const detail = (result.stderr || result.error?.message || `exit ${result.status}`).trim().slice(-4_000);
  return new Error(`Claude ${operation} failed: ${detail}`);
}

// Flags that make each call a fresh, customization-free process: --safe-mode
// disables skills, plugins, CLAUDE.md, hooks, MCP, and custom agents, while an
// empty --setting-sources and --no-session-persistence keep no state between
// calls. The skill under test reaches the model only as an explicit file path
// in the with_skill prompt, mirroring the Codex harness.
const isolationFlags = [
  "--safe-mode",
  "--setting-sources",
  "",
  "--no-session-persistence",
];

export function describe(context) {
  const command = executable(context.options);
  const result = spawnSync(command, ["--version"], { cwd: context.root, encoding: "utf8", timeout: 30_000 });
  if (result.error || result.status !== 0) throw failure(result, "version check");
  return {
    name: "claude",
    version: result.stdout.trim(),
    capabilities: {
      verifiedSkillIsolation: true,
      tokenUsage: true,
      resolvedModel: true,
      traces: true,
    },
    configuration: { executable: command },
  };
}

export function preflight(context) {
  // Verify the executable is reachable; describe() already ran --version, and
  // the isolation guarantee here is structural: every execute() call passes
  // --safe-mode (disables skills, plugins, CLAUDE.md, hooks, MCP, and custom
  // agents) plus an empty --setting-sources and --no-session-persistence, so no
  // globally installed skill is visible unless the with_skill prompt points at
  // its SKILL.md explicitly.
  executable(context.options);
  return {
    isolation: {
      verified: true,
      globalSkillVisibility: "disabled with --safe-mode and empty --setting-sources",
      skillLoading: "explicit SKILL.md path read from the with_skill prompt only",
      freshContextPerCall: true,
    },
    resolvedModel: null,
    warnings: [],
  };
}

export function execute(request) {
  const command = executable(request.options);
  const unknownInference = Object.keys(request.inference).filter((key) => key !== "reasoningEffort");
  if (unknownInference.length > 0) {
    throw new Error(`Unsupported Claude inference option: ${unknownInference.join(", ")}`);
  }
  const effort = request.inference.reasoningEffort;
  if (effort !== undefined && (typeof effort !== "string" || !reasoningEfforts.has(effort))) {
    throw new Error(`Claude reasoningEffort must be one of: ${[...reasoningEfforts].join(", ")}`);
  }

  const conditionInstruction = request.condition === "with_skill"
    ? `Use the skill at ${request.skillPath}. Read SKILL.md completely and read only the references it directs you to for this task.`
    : "No task-specific skill is available. Solve the request directly.";
  const inputInstruction = request.inputFiles.length > 0
    ? `\n\nInput files:\n${request.inputFiles.map((path) => `- ${path}`).join("\n")}`
    : "";
  const prompt = `${conditionInstruction}\nDo not inspect eval definitions, benchmark outputs, or sibling workspaces.${inputInstruction}\n\nUser request:\n${request.task}`;

  const args = [
    "-p",
    "--output-format", "json",
    ...isolationFlags,
    "--model", request.model,
    // Read-only tool set keeps the disposable workspace unmodified, matching the
    // Codex harness read-only sandbox; bypassPermissions prevents non-interactive
    // permission prompts from stalling the call.
    "--tools", "Read,Grep,Glob",
    "--permission-mode", "bypassPermissions",
  ];
  if (effort) args.push("--effort", effort);

  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: request.workspace,
    input: `${prompt}\n`,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: request.timeoutMs,
  });
  const durationMs = Date.now() - started;
  if (result.error || result.status !== 0) throw failure(result, "execution");

  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Claude returned invalid JSON: ${error.message}`);
  }
  if (payload.is_error || payload.subtype !== "success") {
    throw new Error(`Claude reported an unsuccessful result: ${payload.subtype ?? "unknown"}`);
  }
  if (typeof payload.result !== "string") throw new Error("Claude completed without a final result string");

  const usage = payload.usage ?? {};
  const models = Object.keys(payload.modelUsage ?? {});
  const warnings = models.length > 1
    ? [`Claude reported usage for multiple models: ${models.join(", ")}`]
    : [];

  return {
    response: payload.result,
    resolvedModel: models.length === 1 ? models[0] : null,
    durationMs,
    usage: {
      inputTokens: usage.input_tokens,
      cachedInputTokens: usage.cache_read_input_tokens,
      outputTokens: usage.output_tokens,
      reasoningTokens: null,
    },
    traces: request.keepTraces ? {
      "result.json": result.stdout || "",
      "stderr.log": result.stderr || "",
    } : {},
    warnings,
  };
}
