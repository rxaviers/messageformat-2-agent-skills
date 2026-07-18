Now producing the resource.

```mfr
# Acme Inbox messages. This resource covers the notification strings shown
# in the Inbox module, including badges and headers.

---

# Notification strings for the Acme Inbox, including the panel title and
# unread-count badge shown to the user.
inbox.notifications.title = Notifications

@param $count - Number of unread notifications in the inbox.
inbox.notifications.count =
  .input {$count :integer}
  .match $count
  one {{You have {$count} new notification.}}
  *   {{You have {$count} new notifications.}}
```
