### Translators: Messages for Acme Inbox notifications.
---
locale: en
---

## Inbox notification messages.
[inbox.notifications]
title = Notifications
# @param $count: integer — The number of notifications.
count = { $count ->
    [one] You have one notification.
   *[other] You have { $count } notifications.
}