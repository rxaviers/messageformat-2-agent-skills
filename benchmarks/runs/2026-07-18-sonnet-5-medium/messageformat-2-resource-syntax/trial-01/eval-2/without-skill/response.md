## Errors identified

**Resource-container errors (structural/.mfr syntax, not MF2):**

1. **Stray `---` separator** – the container format has no document-separator token. Placing `---` between the entry and the header content is invalid; resource-level metadata (`@owner`, comments) must simply appear at the top of the file, with no separator syntax.
2. **`welcome = Hello` declared before any header/section** – this entry sits above the `@owner` metadata and the `[settings]` section header, i.e. outside any section. Entries must be declared inside a section (after the resource metadata), not interleaved above it.
3. **`bad?key = Oops` – invalid identifier** – `?` is not a legal character in a resource key. Keys must consist of letters, digits, `_`, or `-` (optionally dot-namespaced); punctuation like `?` breaks the identifier grammar.
4. **Un-indented multi-line message body for `items`** – after `items =`, the continuation lines (`.input …`, `.match …`, `one {{…}}`, `* {{…}}`) are flush-left, so the container parser cannot tell they belong to `items` rather than being separate top-level entries. Continuation lines of a multi-line value must be indented relative to the `key =` line.

**Embedded MF2 error:** none. The message body itself is well-formed MF2:
- `.input {$count :integer}` is a valid local declaration using the registered `:integer` function.
- `.match $count` correctly selects on the declared variable.
- Variants `one {{One item}}` and `* {{Many items}}` each supply exactly one key for the single selector, and the required catch-all `*` variant is present.

## Corrected resource

```mfr
@owner localization

# Settings strings.
[settings]
welcome = Hello
badkey = Oops
items =
  .input {$count :integer}
  .match $count
  one {{One item}}
  * {{Many items}}
```
