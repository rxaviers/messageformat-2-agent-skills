# MessageFormat 2 Syntax Benchmark

The skill passed all 12 assertions. The no-skill baseline passed 9 of 12, a paired improvement of 25 percentage points in this exploratory run.

The skill added value on exact MF2 matcher syntax, the requested `:integer` annotation, and the distinction between syntax and data-model errors. Both conditions handled the whitespace, escaping, variable, and markup case correctly.

This result is directional, not a reliability estimate: each eval was run only once, and timing, token usage, and grader configuration were not captured.
