```mfr
# UI strings for the welcome screen and confirmation prompts.

plain.title = Welcome

# Explains the number of items shown in a collection.
@param $count - Number of items in the collection.
items =
  .input {$count :integer}
  .match $count
  one {{{$count} item}}
  *   {{{$count} items}}

# Separator used to join list items; preserves a trailing space after the comma.
separator = |, |

# Confirmation prompt shown before a destructive or irreversible action.
are_you_sure\x3f = Continue?
```
