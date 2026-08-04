# Publish Checklist

- Verify the main meal logging flow on 360px, 375px, 390px, 768px, and 1024px widths.
- Confirm there is no horizontal scroll on the main app screen, support page, and privacy page.
- Open the deployed app URL, support URL, and privacy URL on the public host.
- Verify both Vercel clean URLs and GitHub Pages `.html` URLs for support and privacy pages.
- Check that `manifest.json`, `theme-color`, icons `192` and `512`, and `apple-touch-icon` are reachable.
- Install the app as a PWA on iPhone and Android.
- Open the app once online, then confirm the shell opens offline.
- Confirm exported data downloads correctly.
- Confirm the support email is visible and tappable from support and privacy pages.
- Smoke-check the public deploy after release, not only localhost.
