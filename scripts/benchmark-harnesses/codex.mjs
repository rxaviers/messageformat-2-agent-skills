import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const apiVersion = 1;

function executable(options) {
  const unknown = Object.keys(options).filter((key) => key !== "executable");
  if (unknown.length > 0) throw new Error(`Unsupported Codex harness option: ${unknown.join(", ")}`);
  const command = options.executable ?? "codex";
  if (typeof command !== "string" || command.length === 0) throw new Error("Codex executable must be a non-empty string");
  return command;
}

function parseEvents(stdout) {
  return stdout.split("\n").flatMap((line) => {
    try {
      return line.trim() ? [JSON.parse(line)] : [];
    } catch {
      return [];
    }
  });
}

function failure(result, operation) {
  const detail = (result.stderr || result.error?.message || `exit ${result.status}`).trim().slice(-4_000);
  return new Error(`Codex ${operation} failed: ${detail}`);
}

export function describe(context) {
  const command = executable(context.options);
  const result = spawnSync(command, ["--version"], { cwd: context.root, encoding: "utf8", timeout: 30_000 });
  if (result.error || result.status !== 0) throw failure(result, "version check");
  return {
    name: "codex",
    version: result.stdout.trim(),
    capabilities: {
      verifiedSkillIsolation: true,
      tokenUsage: true,
      resolvedModel: false,
      traces: true,
    },
    configuration: { executable: command },
  };
}

export function preflight(context) {
  const command = executable(context.options);
  const result = spawnSync(command, [
    "debug",
    "prompt-input",
    "--config",
    "skills.include_instructions=false",
    "benchmark isolation probe",
  ], { cwd: context.root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024, timeout: 30_000 });
  if (result.error || result.status !== 0) throw failure(result, "isolation preflight");
  const leaked = context.targetSkillNames.filter((name) => result.stdout.includes(name));
  if (leaked.length > 0) throw new Error(`Codex skill isolation failed; still visible: ${leaked.join(", ")}`);
  return {
    isolation: {
      verified: true,
      globalSkillVisibility: "disabled with skills.include_instructions=false",
      skillLoading: "explicit skill path in the with_skill prompt only",
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
    throw new Error(`Unsupported Codex inference option: ${unknownInference.join(", ")}`);
  }
  if (request.inference.reasoningEffort !== undefined && typeof request.inference.reasoningEffort !== "string") {
    throw new Error("Codex reasoningEffort must be a string");
  }

  const responsePath = join(request.runtimeDir, "codex-last-message.md");
  const conditionInstruction = request.condition === "with_skill"
    ? `Use the skill at ${request.skillPath}. Read SKILL.md completely and read only the references it directs you to for this task.`
    : "No task-specific skill is available. Solve the request directly.";
  const inputInstruction = request.inputFiles.length > 0
    ? `\n\nInput files:\n${request.inputFiles.map((path) => `- ${path}`).join("\n")}`
    : "";
  const prompt = `${conditionInstruction}\nDo not inspect eval definitions, benchmark outputs, or sibling workspaces.${inputInstruction}\n\nUser request:\n${request.task}`;
  const args = [
    "-a", "never", "exec",
    "--model", request.model,
    "--config", "skills.include_instructions=false",
    "--sandbox", "read-only",
    "--ephemeral",
    "--skip-git-repo-check",
    "--json",
    "--cd", request.workspace,
    "--output-last-message", responsePath,
  ];
  if (request.inference.reasoningEffort) {
    args.push("--config", `model_reasoning_effort=${JSON.stringify(request.inference.reasoningEffort)}`);
  }
  args.push(prompt);

  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: request.root,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: request.timeoutMs,
  });
  const durationMs = Date.now() - started;
  if (result.error || result.status !== 0) throw failure(result, "execution");
  if (!existsSync(responsePath)) throw new Error("Codex completed without writing its final response");

  const events = parseEvents(result.stdout || "");
  const completed = events.filter((event) => event.type === "turn.completed").at(-1);
  const usage = completed?.usage ?? {};
  return {
    response: readFileSync(responsePath, "utf8"),
    resolvedModel: null,
    durationMs,
    usage: {
      inputTokens: usage.input_tokens,
      cachedInputTokens: usage.cached_input_tokens,
      outputTokens: usage.output_tokens,
      reasoningTokens: usage.reasoning_output_tokens,
    },
    traces: request.keepTraces ? {
      "events.jsonl": result.stdout || "",
      "stderr.log": result.stderr || "",
    } : {},
    warnings: [],
  };
}
