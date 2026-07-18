Resource-container errors:

1. `---` appears after `welcome`; frontmatter must precede every entry and section.
2. `@owner localization` is detached by the following comment/blank line.
3. `bad?key` has unescaped identifier punctuation; use `bad\x3fkey`.
4. The `items` continuation lines are not indented.

Embedded MF2 errors: none. The `items` message has a typed selector and an all-`*` fallback.

```mfr
---
welcome = Hello

# Settings strings.
@owner localization
[settings]
bad\x3fkey = Oops
items =
  .input {$count :integer}
  .match $count
  one {{One item}}
  * {{Many items}}
```