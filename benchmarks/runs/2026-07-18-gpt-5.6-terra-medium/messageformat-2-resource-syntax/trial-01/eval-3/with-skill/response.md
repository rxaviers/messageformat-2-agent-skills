# Number of items in a collection.
items =
  .input {$count :integer}
  .match {$count :plural}
  one {{{$count} item}}
  *   {{{$count} items}}
plain.title = Welcome
separator = {{, }}
Are\x20you\x20sure\x3f = Continue?