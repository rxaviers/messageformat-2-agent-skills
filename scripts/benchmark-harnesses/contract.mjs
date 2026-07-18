import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const HARNESS_API_VERSION = 1;

const builtInHarnesses = new Map([
  ["codex", "scripts/benchmark-harnesses/codex.mjs"],
  ["claude", "scripts/benchmark-harnesses/claude.mjs"],
  ["process", "scripts/benchmark-harnesses/process.mjs"],
]);

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function assertFunction(module, name, adapterPath) {
  if (typeof module[name] !== "function") {
    throw new Error(`Harness adapter ${adapterPath} must export ${name}()`);
  }
}

function record(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Harness ${field} must be an object`);
  }
  return value;
}

function optionalString(value, field) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Harness ${field} must be a non-empty string or null`);
  }
  return value;
}

function stringArray(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Harness ${field} must be an array of strings`);
  }
  return value;
}

export async function loadHarness(spec, root) {
  const builtInPath = builtInHarnesses.get(spec);
  const adapterPath = builtInPath
    ? resolve(root, builtInPath)
    : resolve(root, spec);
  if (!existsSync(adapterPath)) throw new Error(`Harness adapter not found: ${spec}`);

  const module = await import(pathToFileURL(adapterPath).href);
  if (module.apiVersion !== HARNESS_API_VERSION) {
    throw new Error(`Harness adapter ${spec} uses API ${module.apiVersion}; expected ${HARNESS_API_VERSION}`);
  }
  for (const method of ["describe", "preflight", "execute"]) {
    assertFunction(module, method, adapterPath);
  }

  const pathFromRoot = relative(root, adapterPath);
  return {
    module,
    spec,
    path: adapterPath,
    recordedPath: !pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot) ? pathFromRoot : adapterPath,
    sha256: sha256(readFileSync(adapterPath)),
  };
}

export function validateDescription(description) {
  if (!description || typeof description.name !== "string" || description.name.length === 0) {
    throw new Error("Harness describe() must return a non-empty name");
  }
  if (typeof description.version !== "string" || description.version.length === 0) {
    throw new Error("Harness describe() must return a non-empty version");
  }
  return {
    name: description.name,
    version: description.version,
    capabilities: record(description.capabilities, "describe().capabilities"),
    configuration: description.configuration === undefined
      ? {}
      : record(description.configuration, "describe().configuration"),
  };
}

export function validatePreflight(preflight, allowUnverifiedIsolation) {
  const result = record(preflight, "preflight() result");
  const isolation = record(result.isolation, "preflight().isolation");
  const verified = isolation.verified === true;
  if (verified && (
    typeof isolation.globalSkillVisibility !== "string"
    || typeof isolation.skillLoading !== "string"
    || isolation.freshContextPerCall !== true
  )) {
    throw new Error("Verified isolation must describe globalSkillVisibility and skillLoading, and confirm freshContextPerCall");
  }
  if (!verified && !allowUnverifiedIsolation) {
    throw new Error("Harness could not verify baseline skill isolation; pass --allow-unverified-isolation only for diagnostic runs");
  }
  return {
    isolation,
    resolvedModel: optionalString(result.resolvedModel, "preflight().resolvedModel"),
    warnings: stringArray(result.warnings, "preflight().warnings"),
  };
}

function token(value, field) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < 0) throw new Error(`Harness result ${field} must be a non-negative integer or null`);
  return value;
}

export function validateExecutionResult(result) {
  const execution = record(result, "execute() result");
  if (typeof execution.response !== "string" || execution.response.trim().length === 0) {
    throw new Error("Harness execute() must return a non-empty response string");
  }
  if (!Number.isFinite(execution.durationMs) || execution.durationMs < 0) {
    throw new Error("Harness execute() must return a non-negative durationMs");
  }
  const usage = execution.usage === undefined ? {} : record(execution.usage, "execute().usage");
  return {
    response: execution.response,
    resolvedModel: optionalString(execution.resolvedModel, "execute().resolvedModel"),
    durationMs: execution.durationMs,
    usage: {
      inputTokens: token(usage.inputTokens, "usage.inputTokens"),
      cachedInputTokens: token(usage.cachedInputTokens, "usage.cachedInputTokens"),
      outputTokens: token(usage.outputTokens, "usage.outputTokens"),
      reasoningTokens: token(usage.reasoningTokens, "usage.reasoningTokens"),
    },
    traces: execution.traces === undefined ? {} : record(execution.traces, "execute().traces"),
    warnings: stringArray(execution.warnings, "execute().warnings"),
  };
}
