# Messages displayed by Acme Inbox.
---

# Notification messages shown in the inbox.
[inbox.notifications]
title = Notifications

@param $count - Number of notifications in the inbox.
count =
  .input {$count :integer}
  .match $count
  one {{You have {$count} notification.}}
  *   {{You have {$count} notifications.}}
