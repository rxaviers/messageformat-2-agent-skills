# MessageFormat 2 Resource Syntax Benchmark

The skill passed all 15 assertions: 12 standards assertions and 3 authoring-convention assertions. The no-skill baseline passed 8 of 15, a paired improvement of about 46.7 percentage points in this exploratory run.

The skill added value on comment and metadata attachment, identifier escaping, multiline continuation indentation, embedded MF2 matcher syntax, typed input conventions, and translator context. The baseline correctly preserved the significant trailing space in the separator but failed several container and embedded-message requirements.

This result is directional, not a reliability estimate: each eval was run only once, and timing, token usage, and grader configuration were not captured.
