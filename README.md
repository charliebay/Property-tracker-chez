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
   project as the existing OAuth client above). Make sure the Google Sheets
   API is enabled on that project.
   - If your project allows creating a JSON key for it (Keys tab → Add Key),
     you can use that directly — see "Running locally" below and skip to
     step 3, setting `GOOGLE_SERVICE_ACCOUNT_KEY` as a GitHub secret instead
     of the Workload Identity steps below.
   - Many Google Cloud projects now block service-account key creation by
     default (org policy `iam.disableServiceAccountKeyCreation`/
     `iam.managed.disableServiceAccountKeyCreation`), and it's often not
     something a personal-account project owner can override. If you hit
     that, use **Workload Identity Federation** instead (steps 2 below) —
     no JSON key needed at all, and it's Google's own recommended approach
     for GitHub Actions.
2. **Workload Identity Federation setup** (skip if you're using a JSON key):
   open [Cloud Shell](https://console.cloud.google.com) (the `>_` icon,
   top right of the console) and paste this in, replacing
   `SERVICE_ACCOUNT_EMAIL` with your service account's email
   (e.g. `property-tracker@your-project.iam.gserviceaccount.com`):

   ```bash
   SERVICE_ACCOUNT_EMAIL="SERVICE_ACCOUNT_EMAIL"
   REPO="charliebay/google-sheets-shortcut"
   PROJECT_ID=$(gcloud config get-value project)
   PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

   gcloud services enable iamcredentials.googleapis.com sheets.googleapis.com

   gcloud iam workload-identity-pools create "github-pool" \
     --project="$PROJECT_ID" --location="global" \
     --display-name="GitHub Actions Pool"

   gcloud iam workload-identity-pools providers create-oidc "github-provider" \
     --project="$PROJECT_ID" --location="global" \
     --workload-identity-pool="github-pool" \
     --display-name="GitHub provider" \
     --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
     --attribute-condition="assertion.repository=='$REPO'" \
     --issuer-uri="https://token.actions.githubusercontent.com"

   gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT_EMAIL" \
     --project="$PROJECT_ID" \
     --role="roles/iam.workloadIdentityUser" \
     --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$REPO"

   echo "WORKLOAD_IDENTITY_PROVIDER value:"
   echo "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
   ```

   Copy the printed `projects/.../providers/github-provider` value — that's
   what goes in the `WORKLOAD_IDENTITY_PROVIDER` secret below.
3. Create (or pick) a target Google Sheet, and share it with the service
   account's email as **Editor**.
4. Copy the sheet's ID from its URL.
5. In this repo's GitHub Settings → Secrets and variables → Actions, add:
   - `WORKLOAD_IDENTITY_PROVIDER` — the value printed at the end of step 2
     (JSON-key route: skip this and add `GOOGLE_SERVICE_ACCOUNT_KEY` instead,
     with the downloaded key's full contents)
   - `GCP_SERVICE_ACCOUNT_EMAIL` — the service account's email
     (JSON-key route: skip this one too)
   - `SHEET_ID` — the spreadsheet ID from step 4
   - `NTFY_TOPIC` — a private, hard-to-guess topic name of your choosing
     (e.g. `charlie-property-tracker-x7k2`) for the weekly push notification
6. Install the free [ntfy](https://ntfy.sh/) app (iOS/Android) and subscribe
   to that same topic name — you'll get a push notification after each run
   summarizing how many items succeeded.
7. Once the sheet exists, you can build a one-tap iOS Shortcut ("Open URLs"
   action → the sheet's share link) for quick access from your Home Screen.
8. Trigger the workflow once manually via **Actions → Weekly property value
   tracker → Run workflow** to validate everything end-to-end before waiting
   for the first scheduled Sunday run.
9. After a run or two, add native Sheets charts (Insert → Chart) on a new
   `Dashboard` tab pointing at the `PropertySnapshots`/`SuburbTrends`
   ranges — they'll auto-update as new rows are appended weekly.

### Running locally

With a JSON key (if your project allows creating one):

```
GOOGLE_SERVICE_ACCOUNT_KEY='<json key>' SHEET_ID='<sheet id>' NTFY_TOPIC='<topic>' npm run scrape
```

Without one, authenticate Application Default Credentials once via
`gcloud auth application-default login`, then just:

```
SHEET_ID='<sheet id>' NTFY_TOPIC='<topic>' npm run scrape
```

(`NTFY_TOPIC` is optional — omit it to skip the push notification.) The
first run downloads a Chromium browser for Playwright the first time you run
`npx playwright install --with-deps chromium`.