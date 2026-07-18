plain.title = Welcome
items =
    .input { $count :integer }
    .match $count
    one {{ $count } item}
    * {{ $count } items}
separator = {","}
{"Are you sure?"} = Continue?