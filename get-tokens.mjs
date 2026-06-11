/**
 * Trakt Token Helper
 * 
 * Run this once to exchange your PIN for an access token + refresh token.
 * 
 * Usage:
 *   node get-tokens.mjs YOUR_CLIENT_ID YOUR_CLIENT_SECRET YOUR_PIN_CODE
 * 
 * Example:
 *   node get-tokens.mjs abc123def456 secret789xyz 12345678
 */

const [clientId, clientSecret, pinCode] = process.argv.slice(2);

if (!clientId || !clientSecret || !pinCode) {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              Trakt Token Helper                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Usage:                                                      ║
║    node get-tokens.mjs CLIENT_ID CLIENT_SECRET PIN_CODE      ║
║                                                              ║
║  Steps:                                                      ║
║    1. Go to trakt.tv/oauth/applications to get your          ║
║       Client ID and Client Secret                            ║
║                                                              ║
║    2. Open this URL in your browser to get a PIN:            ║
║       https://trakt.tv/oauth/authorize                       ║
║         ?response_type=code                                  ║
║         &client_id=YOUR_CLIENT_ID                            ║
║         &redirect_uri=urn:ietf:wg:oauth:2.0:oob             ║
║                                                              ║
║    3. Run this script with all three values                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

console.log("\n⏳ Exchanging PIN for tokens...\n");

const response = await fetch("https://api.trakt.tv/oauth/token", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "ott-to-trakt-sync/1.0",
  },
  body: JSON.stringify({
    code: pinCode.trim(),
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
    grant_type: "authorization_code",
  }),
});

if (!response.ok) {
  const errText = await response.text();
  console.error(`❌ Error ${response.status}: ${errText}`);
  console.error("\nMake sure your PIN is fresh (they expire quickly). Get a new one and try again.");
  process.exit(1);
}

const data = await response.json();

console.log("✅ Success! Here are your tokens:\n");
console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  Copy these into your GitHub Secrets:                       ║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log(`║  TRAKT_ACCESS_TOKEN:                                        ║`);
console.log(`║  ${data.access_token}`);
console.log("║                                                              ║");
console.log(`║  TRAKT_REFRESH_TOKEN:                                       ║`);
console.log(`║  ${data.refresh_token}`);
console.log("║                                                              ║");
console.log(`║  Token expires in: ${Math.round(data.expires_in / 86400)} days`);
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log(`
Next steps:
  1. Go to: https://github.com/pratiks360/ott-to-trakt-in/settings/secrets/actions
  2. Add these 4 secrets:
     • TRAKT_CLIENT_ID     = ${clientId}
     • TRAKT_CLIENT_SECRET = ${clientSecret}
     • TRAKT_ACCESS_TOKEN  = (the value above)
     • TRAKT_REFRESH_TOKEN = (the value above)
  3. Trigger a manual run: Actions → Auto Sync OTT → Trakt → Run workflow
`);
