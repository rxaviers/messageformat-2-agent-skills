Resource-container errors:

1. `welcome = Hello` appears before the required resource header delimiter `---`; move it below the delimiter.
2. `bad?key` is not a valid message identifier because `?` is not allowed. Rename it, for example, to `bad_key`.

The embedded MF2 message under `items` is syntactically valid. `:integer` is acceptable if the host registers that function.

Corrected resource:

```mfr
---
@owner localization

welcome = Hello

# Settings strings.
[settings]
bad_key = Oops
items =
.input {$count :integer}
.match $count
one {{One item}}
* {{Many items}}
```