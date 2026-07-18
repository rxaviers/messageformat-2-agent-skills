The resource-container errors are:

1. `---` is a frontmatter terminator, so it cannot appear after the `welcome` entry. Because the resource has no frontmatter before that point, remove it. The `@owner localization` line may remain after it is removed; there it is metadata for the following `[settings]` section.
2. `bad?key` is not a valid entry identifier because `?` is not allowed in an identifier. It can be changed to `bad-key`.
3. The lines belonging to the multiline `items` value must be indented. Without indentation, they are parsed as resource-level lines rather than as the entry's value.

There is no embedded MF2 error. Once its lines are correctly included in the `items` value, the input declaration, matcher, `one` variant, and fallback variant form a valid MF2 message.

Corrected resource:

```mfr
welcome = Hello

@owner localization

# Settings strings.
[settings]
bad-key = Oops
items =
  .input {$count :integer}
  .match $count
  one {{One item}}
  * {{Many items}}
```
