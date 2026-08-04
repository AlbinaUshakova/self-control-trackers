# Native Packaging Setup

If EatLog is wrapped for app stores later, use the structure below:

```text
dist/
android/
ios/
```

Recommended wrapper stack:

- Capacitor

Preparation steps:

- Keep the web app deployable and stable first.
- Produce a final icon set before native packaging.
- Reuse the public support and privacy URLs in store metadata.
- Run the release QA checklist on the public web build before generating native shells.
