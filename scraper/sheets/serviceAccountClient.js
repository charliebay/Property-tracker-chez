const { google } = require('googleapis');

// Builds an authenticated Sheets API client. Deliberately independent of
// server.js's OAuth2/refresh-token client - this needs no interactive
// consent, which is what makes it viable for an unattended weekly CI run.
//
// Two auth paths, tried in order:
//  1. GOOGLE_SERVICE_ACCOUNT_KEY - a service-account JSON key, for setups
//     where key creation is allowed (e.g. local testing).
//  2. Application Default Credentials (ADC) - used when no key is set. In
//     the GitHub Actions workflow this is populated by the
//     google-github-actions/auth step, which exchanges GitHub's OIDC token
//     for short-lived Google credentials via Workload Identity Federation -
//     no long-lived key required, needed because many GCP projects now
//     block service-account key creation by org policy.
async function getSheetsClient() {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

  let auth;
  if (rawKey) {
    let credentials;
    try {
      credentials = JSON.parse(rawKey);
    } catch (err) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
    }
    auth = new google.auth.GoogleAuth({ credentials, scopes });
  } else {
    auth = new google.auth.GoogleAuth({ scopes });
  }

  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

module.exports = { getSheetsClient };
