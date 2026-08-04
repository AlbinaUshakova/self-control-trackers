# Release QA Checklist

- Test the main scenario: add meal, add snack, edit entry, delete entry, export data, reset history.
- Confirm first-use empty states for today and statistics are readable in Russian and English.
- Check that text inputs stay at 16px on mobile and do not trigger iPhone auto-zoom.
- Check tap targets for language switch, period chips, row actions, and footer links.
- Confirm history older than 21 days is pruned without breaking current-day state.
- Confirm app state survives reload and tab switching in the same browser profile.
- Verify focus-visible states for buttons, inputs, and footer links.
- Verify the day detail view opens from statistics and remains read-only.
- Confirm support and privacy pages describe storage, retention, account, server, and sync status accurately.
