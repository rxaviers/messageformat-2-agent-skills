# Benchmarks

Benchmark records are append-only evidence for how much each skill improves agent output. Test definitions remain in `skills/<skill-name>/evals/evals.json`; observed results belong here.

This workflow follows the Agent Skills guide to [evaluating skill output quality](https://agentskills.io/skill-creation/evaluating-skills).

## Run Layout

Each run compares paired conditions using the same harness, model, inference settings, prompt, and input files:

```text
runs/<run-id>/
  manifest.json
  <skill-name>/
    benchmark.json
    grading.json
    report.md
    trial-<NN>/
      eval-<id>/
        with-skill/response.md
        without-skill/response.md
```

Use an immutable run ID containing the date, model, and relevant inference profile. Never replace an old run when a skill, eval, model, harness, or grading rubric changes; add a new run instead.

## Required Method

1. Run every eval in a clean context once with the skill and once without it. Change no other model setting between the paired conditions.
2. Record the exact harness, requested and resolved model identifiers, inference settings, skill commit, skill hash, eval hash, runner, and grader in `manifest.json`.
3. Save the raw response for every condition and trial.
4. Grade every assertion with a pass/fail result and concrete evidence. Keep standards, conventions, and quality categories separate.
5. Aggregate per-eval and overall counts in `benchmark.json`. Report the paired pass-rate delta, tokens, and duration when available.
6. Use at least five trials per eval for a benchmark intended to support reliability claims. Label one-off runs as `exploratory` and do not report standard deviation for them.
7. Add a short `report.md` describing material wins, failures, limitations, and any human review.

Do not commit full execution transcripts by default. They add noise and can contain unrelated or sensitive context. Preserve them only when they are necessary to explain a failure.

## Validation

Run:

```sh
node scripts/validate-benchmarks.mjs
```

The validator checks immutable source hashes against the recorded Git commit, verifies aggregate arithmetic, and ensures that grading and raw response files exist.

## Running a New Suite

Commit the skill and eval definitions, configure the target harness, and inspect the execution plan. The built-in Codex adapter remains the default:

```sh
node scripts/run-benchmarks.mjs \
  --model=gpt-5.6-luna \
  --reasoning-effort=medium \
  --trials=1 \
  --run-id=2026-07-18-gpt-5.6-luna-medium \
  --dry-run
```

Remove `--dry-run` to execute the suite. The runner:

- delegates model execution and isolation checks to a harness adapter;
- requires the adapter to verify baseline skill isolation, unless the run is explicitly marked diagnostic with `--allow-unverified-isolation`;
- uses a separate temporary workspace and runtime directory for every call;
- exposes only the target skill snapshot, without its eval definitions, to the with-skill condition;
- supplies no skill snapshot to the without-skill condition;
- deterministically varies which condition runs first and records the seed and execution order;
- records responses, timing, normalized token usage, source hashes, adapter identity, harness version, and an initial manifest;
- refuses unsafe or existing run IDs and publishes the completed capture atomically;
- removes temporary workspaces after the run.

Full JSONL events and stderr logs are omitted by default. Add `--keep-traces` only when execution details are needed to diagnose a failure.

The generated schema-v3 manifest has status `outputs_captured_pending_grading`. Grade the assertions, add `benchmark.json` and `report.md`, and change the status to `complete` only when the record is finished. Use five trials for a reliability-oriented benchmark; use one trial only for exploratory iteration.

Run `node scripts/run-benchmarks.mjs --help` for model, skill-selection, timeout, seed, and trace options.

### Other Harnesses

The benchmark core does not import a model SDK or construct harness-specific commands. Choose a built-in adapter with `--harness`, or supply the path to a JavaScript adapter module:

```sh
node scripts/run-benchmarks.mjs \
  --harness=./scripts/benchmark-harnesses/my-harness.mjs \
  --harness-option=endpoint=http://localhost:3000 \
  --model=my-model \
  --inference=temperature=0 \
  --run-id=2026-07-18-my-harness-my-model \
  --dry-run
```

An adapter exports `apiVersion = 1` and three functions:

- `describe(context)` returns its name, version, capabilities, and non-secret configuration to record.
- `preflight(context)` reports how it verified that the baseline cannot discover the target skills.
- `execute(request)` runs one isolated arm and returns a response, duration, optional resolved model, normalized token usage, warnings, and optional trace artifacts.

See the built-in [Codex adapter](../scripts/benchmark-harnesses/codex.mjs) for a direct CLI integration.

For harnesses written in another language, use the built-in `process` adapter. It runs a command that exchanges one JSON object over standard input and output:

```sh
node scripts/run-benchmarks.mjs \
  --harness=process \
  --harness-option=command=./bin/my-benchmark-harness \
  --harness-option=name=my-harness \
  --harness-option=version=1.0.0 \
  --model=my-model \
  --run-id=2026-07-18-my-harness-my-model \
  --dry-run
```

The command receives either `{ "apiVersion": 1, "type": "preflight", "context": ... }` or `{ "apiVersion": 1, "type": "execute", "request": ... }`. It must write exactly one JSON result to standard output; standard error is reserved for diagnostics. The [process adapter](../scripts/benchmark-harnesses/process.mjs) defines the request fields and transports the result unchanged to the shared contract validation.
