- **Duplicate option (syntax/data-model):** `select` is specified twice. An option may appear only once.
- **Conflicting selection mode (data-model):** `select=exact` disables plural-category matching, so it conflicts with the intended `one`/plural behavior. Use `select=plural` (or omit it, since plural is the default).
- **Missing fallback variant (data-model):** `other` is a literal key, not the required catch-all key. Use `*`.
- **Invalid line-break representation (syntax):** MF2 does not use `\n` as a newline escape. Put an actual line break in the pattern.

```mf2
.input {$count :integer select=plural}
.match $count
one {{Line one
{$count} item}}
* {{Line one
{$count} items}}
```