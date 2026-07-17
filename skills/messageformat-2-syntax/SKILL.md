---
name: messageformat-2-syntax
description: Author, edit, and validate Unicode MessageFormat 2 message syntax. Use when writing or explaining MF2 patterns, placeholders, expressions, declarations, functions and options, selectors and variants, quoted literals, markup, attributes, escaping, whitespace, or when distinguishing well-formed messages from semantically valid messages. Covers a single MF2 message; combine with a resource-format skill for .mfr containers.
---

# MessageFormat 2 Syntax

Apply the Unicode LDML Part 9 syntax for a single MF2 message. Do not treat container syntax such as resource IDs, comments, or sections as part of the message grammar.

## Workflow

1. Classify the message as simple or complex.
2. Write or parse it using the rules below.
3. Check grammatical well-formedness against [references/message.abnf](references/message.abnf) when exact syntax matters.
4. Check semantic validity separately; an ABNF match alone does not make a message valid.
5. Preserve pattern and quoted-literal whitespace exactly.

## Choose the Message Form

- Use a **simple message** for one pattern with no declarations or matcher: `Hello, {$name}!`
- Use a **complex message** for declarations, selection, or an explicitly quoted body. Put declarations first, followed by either one quoted pattern or one matcher.
- Wrap a complex pattern in `{{` and `}}`: `.local $name = {|Ada|} {{Hello, {$name}!}}`
- Remember that an empty simple message and an empty quoted pattern (`{{}}`) are both allowed.
- If a simple message's first non-whitespace character would be `.`, quote it as a complex pattern.

Whitespace outside patterns and quoted literals is structural and generally insignificant. Whitespace inside pattern text or quoted literals is content and must be preserved.

## Write Expressions and Literals

- Reference a variable with `{$name}`.
- Apply a function with `{$count :number}` or use a function-only expression such as `{:platform}`.
- Pass options after a function: `{$date :date length=long}`. An option value is a literal or variable, and option names within one function must be unique.
- Use an unquoted literal only when it satisfies the grammar. Otherwise delimit it with `|`, for example `{|text with spaces|}`.
- Do not nest expressions or leave an expression empty.
- Use namespaced custom identifiers such as `:acme:format`; the one-letter namespace `u` is reserved by Unicode.
- Prefer NFC for names and literals because name and matcher-key comparisons use canonical equivalence.

Only `\\`, `\{`, `\|`, and `\}` are MF2 escape sequences. Do not invent escapes such as `\n`. Escape `\\` everywhere, `{` and `}` in patterns, and `|` inside quoted literals. Avoid optional escapes.

## Declare Values

- Bind and optionally annotate an external variable with `.input {$count :number}`.
- Bind a local value with `.local $label = {|Inbox|}`.
- Declare each variable at most once.
- Do not bind a variable that appeared anywhere in an earlier declaration.
- In `.local`, do not reference the variable being bound in its expression. In `.input`, the operand is necessarily the variable being bound, but do not reference it again inside the function or its options.

## Select Variants

Annotate each selector through an input or local declaration, then match declared variables:

```mf2
.input {$count :integer}
.match $count
one {{You have one message.}}
*   {{You have {$count} messages.}}
```

For every matcher:

- Provide at least one selector and one variant.
- Give every variant exactly one key per selector.
- Keep every key tuple unique.
- Include a fallback variant whose keys are all `*`.
- Use `|*|` when the literal string `*`, rather than the catch-all key, is intended.

## Use Markup and Attributes

- Write open, standalone, and close markup as `{#tag}`, `{#tag /}`, and `{/tag}`.
- Put markup options before attributes.
- Attach metadata to expressions or markup with `@name` or `@name=literal`.
- Prefer unique attribute names; when repeated, only the last value is used.
- Do not infer XML-style balance rules: base MF2 syntax permits unmatched or arbitrarily ordered markup. A markup implementation may impose additional rules.

## Validity Checklist

- Parse successfully with the ABNF.
- Reject duplicate declarations and duplicate function option names.
- For matchers, reject key-count mismatches, missing all-`*` fallback variants, unannotated selectors, and duplicate key tuples.
- Keep `.input`, `.local`, and `.match` lowercase.
- Treat unresolved variables, unknown functions, and bad operands or options as resolution/function errors rather than syntax errors.
