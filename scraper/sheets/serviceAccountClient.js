const { google } = require('googleapis');

// Builds an authenticated Sheets API client from a service-account JSON key,
// read from GOOGLE_SERVICE_ACCOUNT_KEY (a GitHub Actions secret containing
// the full key file contents). Deliberately independent of server.js's
// OAuth2/refresh-token client - a service account needs no interactive
// consent, which is what makes it viable for an unattended weekly CI run.
async function getSheetsClient() {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');
  }

  let credentials;
  try {
    credentials = JSON.parse(rawKey);
  } catch (err) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();

  return google.sheets({ version: 'v4', auth: authClient });
}

module.exports = { getSheetsClient };
