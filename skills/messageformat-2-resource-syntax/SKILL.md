---
name: messageformat-2-resource-syntax
description: Author, edit, and validate proposed W3C Message Resource (.mfr) syntax for files containing Unicode MessageFormat 2 messages. Use when writing or maintaining MF2 resources, migrating localization resources to .mfr, checking resource syntax and identifiers, adding metadata or sections, documenting placeholders for translators, or reviewing resource organization and translator context. Treat the container format as a proposal, not as part of the Unicode MF2 standard.
---

# MessageFormat 2 Resource Syntax

Author, edit, and validate `.mfr` resources that are syntactically valid, consistently organized, and clear to translators.

Treat `.mfr` as the proposed W3C Message Resource format. It is not currently part of the Unicode MessageFormat 2 standard and may change independently of MF2 message syntax.

## Workflow

1. Read [references/mfr-authoring.md](references/mfr-authoring.md) before changing or reviewing a resource. Apply its authoring rules, proposal semantics, and checklist.
2. Read [references/message-resource.abnf](references/message-resource.abnf) when exact resource grammar matters. Treat each entry value as an MF2 message and validate that message separately against Unicode MF2 syntax.
3. Inspect nearby `.mfr` files and repository instructions. Preserve established naming, section order, indentation, and newline style unless they conflict with explicit requirements.
4. Identify the task:
   - For authoring, choose stable dot-separated identifiers and add translator-focused context.
   - For migrations, preserve source meaning, placeholders, selector behavior, and significant whitespace.
   - For maintenance, avoid unintended semantic changes and keep related entries compact.
   - For review, report actionable findings with file and line references; do not rewrite unless asked.
5. Author every dynamic message with `@param` metadata and typed `.input` declarations. Ensure selectors have an exhaustive fallback variant.
6. Validate the finished resource against the review checklist in the reference. Re-read multiline values and escaped identifier punctuation carefully.

## Output Expectations

- Preserve user-facing meaning and translator context.
- Prefer the smallest coherent change.
- Distinguish structural dots from literal punctuation in identifiers.
- Preserve significant whitespace with quoted literals.
- State any syntax or semantic uncertainty instead of silently guessing.
