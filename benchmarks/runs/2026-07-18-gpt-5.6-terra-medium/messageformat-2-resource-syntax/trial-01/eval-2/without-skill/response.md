Resource-container errors:
- `@owner` is metadata, so it must appear before `---`.
- Metadata assignments require `=`.
- `bad?key` is not a valid message key.

Embedded MF2 error:
- `:integer` is not a standard MF2 formatter; use `:number`.

```mfr
@owner = localization
---
welcome = Hello

# Settings strings.
[settings]
bad-key = Oops
items =
.input {$count :number}
.match $count
one {{One item}}
* {{Many items}}
```