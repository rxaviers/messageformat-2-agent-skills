```mfr
plain.title = Welcome

# Count-sensitive label for an integer number of items.
items =
  .input {$count :integer}
  .match $count
  one {{There is {$count} item}}
  *   {{There are {$count} items}}

# A comma followed by exactly one space.
separator = {{, }}

Are\x20you\x20sure\x3f = Continue?
```