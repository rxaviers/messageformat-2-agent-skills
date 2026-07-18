## Review

**Resource-container errors** (per the `.mfr` proposal grammar):

1. **Entry before frontmatter** — `welcome = Hello` appears before the `---` frontmatter marker. The grammar forbids any entry or section-head before frontmatter ("it must not have any section-head or entry lines before the frontmatter").
2. **Orphaned metadata** — `@owner localization` is followed by an empty line before reaching the `[settings]` section-head. Metadata may only have *other metadata* intervene before its target; a comment or empty line breaks the attachment. As written, `@owner` attaches to nothing. (Resource-level metadata like this belongs *before* the frontmatter, so it attaches to the whole resource.)
3. **Unescaped punctuation in identifier** — `bad?key` contains a literal `?`, which is not an `id-safe` character. Per the identifier rules, symbol punctuation inside an identifier part must be hex-escaped: `bad\x3fkey`.
4. **Unindented multiline value** — the `items` entry's continuation lines (`.input`, `.match`, `one {{...}}`, `* {{...}}`) have no leading whitespace. The grammar requires every continuation line of a multiline value to be indented by at least one space or tab.
5. **Missing translator metadata** — the `items` message uses placeholder `$count` but has no `@param $count` metadata describing it, which the authoring checklist requires for every placeholder.

**Embedded MF2 error**: none. Once properly indented, the `items` message body itself is valid MF2 — `.input {$count :integer}` is typed, `.match $count` has an exhaustive fallback variant (`*`), and both variants are well-formed patterns.

## Corrected resource

```mfr
@owner localization
---
welcome = Hello

# Settings strings.
[settings]
bad\x3fkey = Oops

# Explains the number of items shown in a collection.
@param $count - Number of items in the collection.
items =
  .input {$count :integer}
  .match $count
  one {{One item}}
  *   {{Many items}}
```

Changes made: moved `@owner localization` before the frontmatter so it attaches to the whole resource; moved `welcome = Hello` after the frontmatter; escaped the identifier as `bad\x3fkey`; indented all continuation lines of the `items` message; added the missing `@param $count` metadata and comment, with a spacer line separating it from the preceding entry.
