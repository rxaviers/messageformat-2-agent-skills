- **Data-model error:** `select` is specified twice; function option names must be unique.
- **Syntax error:** `\n` is not an MF2 escape sequence. Use an actual newline to preserve the intended line break.
- **Data-model error:** `other` is a literal matcher key, not a fallback. A matcher requires an all-`*` fallback variant.

```mf2
.input {$count :integer}
.match $count
one {{Line one
{$count} item}}
* {{Line one
{$count} items}}
```