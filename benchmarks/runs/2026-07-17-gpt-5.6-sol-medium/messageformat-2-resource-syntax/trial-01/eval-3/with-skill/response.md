plain.title = Welcome

# Item count shown alongside an item or items.
@param $count - Integer number of items.
items =
  .input {$count :integer}
  .match $count
  one {{{$count} item}}
  *   {{{$count} items}}

# Delimits list items; preserve the single trailing space.
separator = {{, }}

Are\x20you\x20sure\x3f = Continue?
