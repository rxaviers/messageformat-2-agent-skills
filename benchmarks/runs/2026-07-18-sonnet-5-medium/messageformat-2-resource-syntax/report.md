# MessageFormat 2 Resource Syntax Benchmark — Sonnet 5 (medium)

With the skill: 12 of 15 assertions passed (80%). Without the skill: 6 of 15 (40%). Paired improvement: +6 assertions, +40 percentage points in this exploratory run.

## Wins

- Eval 2 (review a broken resource): the skill version correctly diagnosed every container error — frontmatter following an entry, `@owner` detached by a blank line, an unescaped `?` in an identifier, and unindented continuation lines — and correctly separated these from the embedded MF2 message, which it confirmed was valid. The no-skill baseline wrongly claimed the `---` frontmatter marker "has no document-separator token" (denying a real part of the format), never addressed the `@owner` attachment problem, and fixed `bad?key` by deleting the `?` instead of escaping it.
- Eval 1 and eval 3: the skill consistently used real `[section]` headers, `@param` metadata, `:integer` declarations, and hex-escaped identifiers (`bad\x3fkey`, `are_you_sure\x3f`) where the baseline used plain comments instead of `@param`, `:number` instead of `:integer`, and an invalid quoted-string identifier (`"Are you sure?"`) that the grammar does not support.

## Failures and surprises

- Eval 1: even with the skill, no genuine `[inbox.notifications]` section header was produced — the response flattened the section into dotted entry ids (`inbox.notifications.title`, `inbox.notifications.count`) instead. It also placed a blank line between the resource-level comment and the `---` frontmatter marker, which breaks attachment under the proposal's own rules — the same class of error the skill correctly catches in eval 2's reviewed resource. This was the skill's weakest eval (3/5).
- Eval 3: the skill's `separator = |, |` places a quoted-literal delimiter directly as a bare pattern, which — per the skill's own authoring reference — renders the pipe characters literally instead of resolving to comma-plus-space. The no-skill baseline got this one right with `separator = {{, }}`.

## Limitations

This is a single-trial, single-model exploratory run. Each condition came from an isolated fresh subagent rather than a matched pair from the same context, reasoning effort was not independently verifiable per call, and token/timing telemetry was not captured. Grading was done by the coordinating session reading raw responses against the skill's own reference material, not by a separate grading harness.
