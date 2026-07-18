# MessageFormat 2 Resource Syntax — gpt-5.6-luna medium

The skill arm passed 14/15 assertions (93.3%), compared with 8/15 (53.3%) without the skill: a 40 percentage-point improvement.

Both arms passed all 12 standards assertions with the skill, while the no-skill arm passed 6/12. The skill reliably handled frontmatter placement, metadata attachment, escaped identifiers, continuation indentation, and embedded MF2. Both arms passed 2/3 convention assertions; the skill response included translator context but omitted optional `@param` metadata in the migration case, so the current convention assertion was not fully satisfied.

The skill cost 13,820 ms and 5,410 additional input tokens across the three cases in this single trial. Output tokens increased by 989 and reasoning output by 47. These are directional measurements, not reliability estimates.

The `@param` assertion should be reconsidered in a future eval revision because the skill explicitly treats that metadata as a recommended convention rather than a syntax requirement.
