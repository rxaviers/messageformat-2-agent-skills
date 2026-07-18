# MessageFormat 2 Syntax Benchmark — Sonnet 5 (medium)

With the skill: 9 of 12 assertions passed (75%). Without the skill: 8 of 12 (67%). Paired improvement: +1 assertion, +8.3 percentage points in this exploratory run.

## Wins

- Eval 1: the skill produced a typed `:integer` declaration and a plain `.match $count` selector; the no-skill baseline used `:number` and re-annotated `$count` inside `.match {$count :number}`, which is an invalid duplicate declaration.
- Eval 3: the skill version referenced `{$value}` directly, matching the exact placeholder the prompt asked for; the baseline introduced an unneeded `.local $v = {$value}` alias and rendered `{$v}` instead.

## Failures and surprises

- Eval 1: even with the skill, the singular (`one`) variant read "You have one notification." with no `{$count}` placeholder, failing the assertion that both variants display `{$count}`. This mirrors the skill's own SKILL.md example (`one {{You have one message.}}`), which uses the same idiom — the skill's habitual phrasing conflicts with this eval's literal requirement.
- Eval 2: both conditions misclassified the duplicate `select` option as a syntax/well-formedness error instead of a data-model error, so the skill did not fix this weak spot. The no-skill baseline actually labeled the missing `*` fallback correctly as a data-model error, while the with-skill answer only fixed it without naming the error category, so the baseline edged out the skill on this eval (3/4 vs 2/4).

## Limitations

This is a single-trial, single-model exploratory run. Each condition came from an isolated fresh subagent rather than a matched pair from the same context, reasoning effort was not independently verifiable per call, and token/timing telemetry was not captured. Grading was done by the coordinating session reading raw responses against the skill's own reference material, not by a separate grading harness.
