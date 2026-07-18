# Translator: Acme Inbox notification messages
---

# Notification messages
[inbox.notifications]

title = Notifications

@param $count - Number of notifications
count =
  .input {$count :integer}
  .match $count
  1 {{You have 1 notification.}}
  * {{You have {$count} notifications.}}