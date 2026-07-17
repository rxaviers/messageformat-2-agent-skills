# MessageFormat 2 Resource Authoring Reference

## Status and Scope

The `.mfr` container follows the [W3C Message Resources proposal](https://github.com/w3c/i18n-discuss/tree/gh-pages/explainers). It is not currently part of the Unicode MessageFormat 2 standard. Treat the proposal and Unicode MF2 message syntax as separate layers:

- Parse the resource container with [message-resource.abnf](message-resource.abnf), mirrored from the proposal.
- Parse each entry value as an MF2 message using Unicode LDML Part 9.
- Expect the proposed resource format to evolve.

## Proposal Semantics

- Allow at most one frontmatter marker. Do not put a section header or entry before it.
- Treat entries after a section header as members of that section. Sections do not inherit or nest; write the full section identifier path.
- Attach metadata to the next frontmatter, section header, or entry. Other metadata may intervene, but a comment or empty line breaks the attachment.
- Combine adjacent comments. Attach them to the next frontmatter, section header, or entry unless an empty line intervenes; metadata may intervene.
- Indent every continuation line of a multiline metadata or entry value with at least one space or tab.
- Normalize resource line endings inside values to U+000A. Escape U+000D as `\r` when it is part of a value.
- Preserve MF2 escapes `\\`, `\{`, `\|`, and `\}` through resource parsing without doubling them.

## Syntax Requirements

- Keep frontmatter, sections, entries, comments, and metadata within the resource grammar and attachment rules above.
- Escape identifier punctuation that is not structural, and indent every continuation line of a multiline value.
- Validate every entry value independently as Unicode MF2.
- For an MF2 matcher, annotate each selector with a function either directly in the selector expression or indirectly through a declaration. Include an exhaustive all-`*` fallback variant.

## Recommended Authoring Conventions

- Write translator-context comments, not implementation-location comments. A top-level comment explains the resource; a section comment explains the messages in that section.
- Keep the top-level resource comment separate from the first section comment with one empty line.
- Keep related entries compact. Add a visual spacer before and after message blocks that use `@param` metadata or have complex MF2 bodies.
- Do not leave an empty line between `id =` and the first indented line of its value.
- Add `@param` metadata for placeholders when it gives translators useful context. Describe what the placeholder represents rather than its implementation source.
- Prefer explicit input declarations when known type or function information helps readers, such as `.input {$count :integer}`. A declaration is not required merely because a variable appears in a message.
- Use an MF2 quoted pattern when leading or trailing whitespace is significant. For example, `separator = {{, }}` represents a comma followed by one space. At the top level of pattern text, `|` is a literal character; it does not delimit a quoted literal.
- Put general product content first, ordered alphabetically by section. Keep standalone common utilities next, then leave-review and completion sections last.

## MF2 Syntax

Use a simple message for static text:

```mfr
title = Welcome
```

Use inputs and metadata for interpolated messages:

```mfr
# Explains the number of items shown in a collection.
@param $count - Number of items in the collection.
items =
  .input {$count :integer}
  .match $count
  one {{You have {$count} item.}}
  *   {{You have {$count} items.}}
```

Use a quoted pattern when the complete value must visibly preserve whitespace or includes syntax-significant text:

```mfr
separator = {{, }}
```

Quoted literals such as `|, |` are expression operands and belong inside `{...}`. Writing bars directly in a simple pattern renders the bars.

## Identifier Rules

An identifier is a dot-separated path. Keep structural dots unescaped:

```mfr
product.error.date_time.date_should_be_on_or_after = Select a later date and time.
```

Escape punctuation that is part of a literal phrase or key, using hexadecimal escapes rather than backslash-symbol escapes:

```mfr
are_you_sure\x3f = Are you sure?
this_is_a_sentence\x2e = This is a sentence.
word\x20with\x20spaces = Value
```

Use `\x2e` only when a literal period belongs inside an identifier part; use `.` when it separates identifier parts. Escape other punctuation similarly, for example `?` as `\x3f`, `:` as `\x3a`, and `!` as `\x21`.

The proposal additionally states that an identifier beginning with `---`, or consisting only of hyphens, must escape at least one hyphen as `\-` to avoid ambiguity with frontmatter.

## Resource ABNF

Use [message-resource.abnf](message-resource.abnf), copied verbatim from the W3C proposal, for the complete current grammar.

## Review Checklist

- Ensure all section and entry identifiers satisfy the grammar.
- Ensure frontmatter placement and comment/metadata attachment satisfy the proposal semantics.
- Ensure dots are path separators unless they represent literal punctuation.
- Ensure every MF2 matcher selector has a function annotation and every matcher has an exhaustive fallback variant (`*`).
- Check that no multiline value has a blank first continuation line.
- Convention: check that comments and `@param` metadata give translators enough semantic context to translate accurately.
- Convention: prefer explicit input declarations when known type or function information is useful to maintainers.
