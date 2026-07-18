# Translators: Messages for Acme Inbox notifications.
---

# Translators: Notification labels and counts shown in the Acme Inbox.
[inbox.notifications]

title = Notifications

# Translators: Shown as the number of notifications in the inbox.
@param $count - Number of notifications in the inbox.
count =
  .input {$count :integer}
  .match $count
  one {{You have {$count} notification.}}
  *   {{You have {$count} notifications.}}