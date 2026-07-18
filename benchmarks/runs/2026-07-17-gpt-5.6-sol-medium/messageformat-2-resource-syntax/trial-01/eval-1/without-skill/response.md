# Translators: Strings for the Acme Inbox notification experience.
---

[inbox.notifications]
# Translators: Notification headings and unread-count status text.
title = {{Acme Inbox}}

# @param count The number of unread notifications.
count =
  .input {$count :integer}
  .match $count
  one {{You have one unread notification.}}
  * {{You have {$count} unread notifications.}}
