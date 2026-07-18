plain.title = Welcome

# The count is an integer number of items.
items =
    .input {$count :number maximumFractionDigits=0}
    .match {$count}
    one {{{$count} item}}
    * {{{$count} items}}

# Exactly one U+0020 SPACE follows the comma.
separator = {{, }}

|Are you sure?| = Continue?
