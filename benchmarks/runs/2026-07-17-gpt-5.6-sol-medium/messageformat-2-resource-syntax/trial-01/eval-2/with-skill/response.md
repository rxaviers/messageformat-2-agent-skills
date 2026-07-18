Resource-container errors:

1. `welcome = Hello` appears before the frontmatter marker. If `---` is present, no entry or section header may precede it. Move `---` to the start of the resource.
2. `@owner localization` is left unattached: the empty line after it breaks metadata attachment. To attach it to `[settings]`, place the section comment first, then the metadata, with no empty line before the section header.
3. `bad?key` contains an unescaped `?`, which is not allowed directly in an identifier. Escape the literal punctuation, preferably as `bad\x3fkey`.
4. Every line after `items =` that belongs to its multiline value must be indented. The `.input`, `.match`, and both variant lines are currently unindented, so the resource parser does not include them in the entry value.

Embedded MF2 errors:

None. After fixing the resource-level continuation indentation, the MF2 message is valid: `$count` is annotated with `:integer` through `.input`, and the matcher has an exhaustive `*` fallback.

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
