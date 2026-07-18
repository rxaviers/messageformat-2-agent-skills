```
# Resource: plain messages, pluralized items count, a separator, and a confirmation prompt.

# plain.title: simple welcome banner text.
plain.title = {{Welcome}}

# items: pluralized count of items (migrated from ICU MessageFormat 1
# `{count, plural, one {# item} other {# items}}`). $count is an integer.
items =
    .input {$count :integer}
    .match $count
    one {{{$count} item}}
    *   {{{$count} items}}

# separator: a comma followed by exactly one trailing space. Whitespace is
# significant here — do not trim.
separator = {{, }}

# "Are you sure?": confirmation button/label shown before a destructive or
# irreversible action; source resource key doubles as translator context.
"Are you sure?" = {{Continue?}}
```
