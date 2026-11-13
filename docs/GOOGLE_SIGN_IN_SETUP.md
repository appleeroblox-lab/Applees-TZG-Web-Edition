# Enable Google sign-in for The Zero Gravity Web Edition

The website already calls Supabase's Google OAuth provider. Enable it using your own Google Cloud credentials; the client secret belongs only in Supabase, never in the repository or chat.

1. Open https://console.cloud.google.com/ and choose or create a project.
2. In Google Auth Platform, configure Branding, Audience and Data Access. Use the basic `openid`, email and profile scopes. While the app is in Testing, add your Google account under test users. Publish the OAuth app to allow players outside that test list.
3. In Clients, create an OAuth client with application type **Web application**.
4. Set Authorized JavaScript origins to `https://appleeroblox-lab.github.io`. Add your exact Cloudflare/custom-domain origin too if players use it. Origins do not include `/index.html` or repository paths.
5. Set Authorized redirect URIs to `https://zwtcytzaozysxiqixihk.supabase.co/auth/v1/callback`. Confirm this matches the callback displayed in your project's Google provider settings.
6. Copy the new Client ID and Client Secret into Supabase → Authentication → Sign In / Providers → Google, enable the provider, and Save.
7. In Supabase → Authentication → URL Configuration, add the actual game URLs to Redirect URLs:
   - `https://appleeroblox-lab.github.io/Applees-TZG-Web-Edition/index.html`
   - `https://appleeroblox-lab.github.io/Applees-TZG-Web-Edition/`
   - Your actual Cloudflare/custom-domain entry URLs, if used.
   Set Site URL to the canonical game entry URL.
8. Open the game, read and accept the rules, then click Continue with Google. New Google players complete their profile and birthday; existing profiles continue normally.

`redirect_uri_mismatch` means Google's redirect URI does not match the Supabase callback. `provider is not enabled` means the Supabase Google provider is disabled or not saved. A testing-only access error means the Google account must be added as a test user or the OAuth app must be published.

Official reference: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
