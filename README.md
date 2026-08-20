# google-sheets-shortcut

A small glitch app for appending to a Google Sheet from iOS Shortcuts

## Getting Started

- You will need to [create an app](https://console.developers.google.com/apis/dashboard) and enable the Google Sheets API.
- Then get the client ID and secret, and set them in the `.env` file. To do this, go to `Create Credentials` > `OAuth client ID`. You will then need to setup the OAuth content screen but all you have to do is set a product name, all other fields are optional. Click save and set the Application type to ‘Web application’. Then you need to provide the ‘Authorized redirect URIs’. This is your Glitch project URL, with '/login/google/return' appended to the end. Your Glitch project URL has the format `https://project-name.glitch.me`. Once done, click Create. Then copy and paste the generated client ID and secret into the `.env` file in your Glitch project.

### Template `.env` Configuration

```
CLIENT_ID=
CLIENT_SECRET=
REFRESH_TOKEN=
SHEET_KEY=
SECRET_KEY=
```

- You get the `SHEET_KEY` from your [spreadsheet's URL](https://webapps.stackexchange.com/questions/74205/what-is-the-key-in-my-google-spreadsheets-url).
- The `SECRET_KEY` is something you should choose. This will be used to authenticate the endpoint from your iOS Shortcut. A good choice would be to use run `openssl rand -base64 24` in your terminal.
- Sign in via the link shown on the homepage of your created Glitch app.
- Go to the Glitch console. You should see that the OAuth tokens have been displayed. Save your `refresh_token` to the `.env` file.
- You can now call the endpoint with a POST to `https://YOUR-PROJECT-NAME.glitch.com/spreadsheet` and the following JSON body structure:

```js
{
    "secret_key": "some secret"     // This must match the secret key in your .env file
    "spreadsheet_key": ""           // The spreadsheet to edit. Optional (defaults to the SHEET_KEY set in .env)
    "data": ["foo", "bar", "baz"]   // A list of values to append to the spreadsheet as a single row
    "spreadsheet_range": ""         // Optional. Where to append the new row (useful if you want to append on the non-default tab of a sheet)
}
```

## Attribution

This was remixed from [https://glitch.com/~google-sheets](https://glitch.com/~google-sheets)

## Weekly property value tracker (`scraper/`)

A separate, self-contained job (unrelated to the iOS Shortcut webhook above,
and using its own Google auth) that scrapes realestate.com.au weekly for a
configured list of properties and suburbs, plus property-market news via
Google News RSS, and logs the results to a Google Sheet. It runs on a
schedule via `.github/workflows/weekly-property-scrape.yml` — no server
needs to be running.

**Heads up:** realestate.com.au's Terms of Service prohibit automated
scraping, and the site runs bot detection. This was built with that risk
accepted — expect some weeks to log partial results (see the `status`
column in the sheet) rather than assuming 100% success every run.

### What it tracks

Edit `scraper/config/targets.js` to change what's tracked — no other file
needs editing. Each run writes to three tabs (auto-created on first run):

- `PropertySnapshots` — per-property realEstimate, confidence, beds/baths/car
- `SuburbTrends` — per-suburb median price, QoQ change, price projection
- `NewsItems` — recent property-market news per suburb

### One-time setup

1. In Google Cloud Console, create a **service account** (can be the same
   project as the existing OAuth client above) and download its JSON key.
   Make sure the Google Sheets API is enabled on that project.
2. Create (or pick) a target Google Sheet, and share it with the service
   account's `client_email` (from the JSON key) as **Editor**.
3. Copy the sheet's ID from its URL.
4. In this repo's GitHub Settings → Secrets and variables → Actions, add:
   - `GOOGLE_SERVICE_ACCOUNT_KEY` — the full downloaded JSON key, pasted as-is
   - `SHEET_ID` — the spreadsheet ID from step 3
   - `NTFY_TOPIC` — a private, hard-to-guess topic name of your choosing
     (e.g. `charlie-property-tracker-x7k2`) for the weekly push notification
5. Install the free [ntfy](https://ntfy.sh/) app (iOS/Android) and subscribe
   to that same topic name — you'll get a push notification after each run
   summarizing how many items succeeded.
6. Once the sheet exists, you can build a one-tap iOS Shortcut ("Open URLs"
   action → the sheet's share link) for quick access from your Home Screen.
7. Trigger the workflow once manually via **Actions → Weekly property value
   tracker → Run workflow** to validate everything end-to-end before waiting
   for the first scheduled Sunday run.
8. After a run or two, add native Sheets charts (Insert → Chart) on a new
   `Dashboard` tab pointing at the `PropertySnapshots`/`SuburbTrends`
   ranges — they'll auto-update as new rows are appended weekly.

### Running locally

```
GOOGLE_SERVICE_ACCOUNT_KEY='<json key>' SHEET_ID='<sheet id>' NTFY_TOPIC='<topic>' npm run scrape
```

(`NTFY_TOPIC` is optional — omit it to skip the push notification.) The
first run downloads a Chromium browser for Playwright the first time you run
`npx playwright install --with-deps chromium`.