Resource-container errors:

1. `welcome = Hello` appears before the frontmatter marker. The `---` marker must precede all entries.
2. `@owner localization` is separated from `[settings]` by a comment, so it does not attach to that section. Move it after the comment.
3. `bad?key` contains unescaped punctuation. Write `bad\x3fkey`.
4. The multiline `items` value is not indented. All continuation lines must begin with whitespace.

Embedded MF2: no errors. The `.input` declaration annotates `$count`, and the matcher has an exhaustive `*` fallback.

Corrected resource:

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