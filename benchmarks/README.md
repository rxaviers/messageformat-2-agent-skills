# Benchmarks

Benchmark records are append-only evidence for how much each skill improves agent output. Test definitions remain in `skills/<skill-name>/evals/evals.json`; observed results belong here.

This workflow follows the Agent Skills guide to [evaluating skill output quality](https://agentskills.io/skill-creation/evaluating-skills).

## Run Layout

Each run compares paired conditions using the same model, reasoning effort, prompt, and input files:

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

Use an immutable run ID containing the date, model, and reasoning effort. Never replace an old run when a skill, eval, model, or grading rubric changes; add a new run instead.

## Required Method

1. Run every eval in a clean context once with the skill and once without it. Change no other model setting between the paired conditions.
2. Record the exact model identifier, reasoning effort, skill commit, skill hash, eval hash, runner, and grader in `manifest.json`.
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
