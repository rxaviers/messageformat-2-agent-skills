# Translator: Messages for Acme Inbox notifications.

---

# Notification message translations.
[inbox.notifications]
title = Notifications

@param $count - Number of notifications.
count =
  .input {$count :integer}
  .match $count
  one {{You have {$count} notification.}}
  *   {{You have {$count} notifications.}}