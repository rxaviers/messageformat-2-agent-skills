```mfr
plain.title = {{Welcome}}
items = {{{$count :number} item}}
    .match {$count :plural}
    one {{\# item}}
    other {{\# items}}
separator = {{, }}
"Are you sure?" = {{Continue?}}
```