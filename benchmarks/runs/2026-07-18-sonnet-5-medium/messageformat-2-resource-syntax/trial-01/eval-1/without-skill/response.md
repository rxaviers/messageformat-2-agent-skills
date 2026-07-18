```
# Acme Inbox — translator resource
# This resource contains user-facing strings for the Inbox feature.
# Please preserve placeholders (the {$...} tokens) and keep punctuation
# consistent with the rest of the Acme Inbox product voice.
---
# Notifications shown in the inbox list and badge count.
[inbox.notifications]

title = {{Notifications}}

# $count: the number of unread notifications to report to the user.
# Type: integer, always >= 0. Provided by the inbox badge/counter service.
.input {$count :number}
.match $count
one {{You have {$count} new notification}}
*   {{You have {$count} new notifications}}
```
