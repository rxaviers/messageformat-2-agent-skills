import { spawnSync } from "node:child_process";

export const apiVersion = 1;

function configuration(options) {
  const allowed = new Set(["command", "argsJson", "name", "version"]);
  const unknown = Object.keys(options).filter((key) => !allowed.has(key));
  if (unknown.length > 0) throw new Error(`Unsupported process harness option: ${unknown.join(", ")}`);
  if (typeof options.command !== "string" || options.command.length === 0) {
    throw new Error("The process harness requires --harness-option=command=<path>");
  }
  let args = [];
  if (options.argsJson) {
    args = Array.isArray(options.argsJson) ? options.argsJson : JSON.parse(options.argsJson);
    if (!Array.isArray(args) || args.some((value) => typeof value !== "string")) {
      throw new Error("Process harness argsJson must be a JSON array of strings");
    }
  }
  return {
    command: options.command,
    args,
    name: String(options.name ?? "process"),
    version: String(options.version ?? "unspecified"),
  };
}

function invoke(config, payload, cwd, timeoutMs) {
  const result = spawnSync(config.command, config.args, {
    cwd,
    input: `${JSON.stringify(payload)}\n`,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: timeoutMs,
  });
  if (result.error || result.status !== 0) {
    const detail = (result.stderr || result.error?.message || `exit ${result.status}`).trim().slice(-4_000);
    throw new Error(`Process harness failed: ${detail}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Process harness returned invalid JSON: ${error.message}`);
  }
}

export function describe(context) {
  const config = configuration(context.options);
  return {
    name: config.name,
    version: config.version,
    capabilities: {
      verifiedSkillIsolation: "adapter-reported",
      tokenUsage: "adapter-reported",
      resolvedModel: "adapter-reported",
      traces: "adapter-reported",
    },
    configuration: {
      command: config.command,
      args: config.args,
    },
  };
}

export function preflight(context) {
  const config = configuration(context.options);
  return invoke(config, {
    apiVersion,
    type: "preflight",
    context: {
      model: context.model,
      inference: context.inference,
      targetSkillNames: context.targetSkillNames,
    },
  }, context.root, 30_000);
}

export function execute(request) {
  const config = configuration(request.options);
  return invoke(config, {
    apiVersion,
    type: "execute",
    request: {
      condition: request.condition,
      task: request.task,
      skillPath: request.skillPath,
      inputFiles: request.inputFiles,
      workspace: request.workspace,
      runtimeDir: request.runtimeDir,
      model: request.model,
      inference: request.inference,
      timeoutMs: request.timeoutMs,
      keepTraces: request.keepTraces,
    },
  }, request.root, request.timeoutMs);
}
