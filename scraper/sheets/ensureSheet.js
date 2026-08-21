// Idempotent: makes sure a tab with the given name (and header row) exists
// in the spreadsheet, creating/writing it only if missing. Safe to call
// every run.
async function ensureTab(sheetsClient, spreadsheetId, tabName, headerRow) {
  const meta = await sheetsClient.spreadsheets.get({ spreadsheetId });
  const existingTitles = (meta.data.sheets || []).map((s) => s.properties.title);

  if (!existingTitles.includes(tabName)) {
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
  }

  const headerRange = `${tabName}!1:1`;
  const current = await sheetsClient.spreadsheets.values.get({ spreadsheetId, range: headerRange });
  const currentHeader = (current.data.values && current.data.values[0]) || [];
  const headerMatches =
    currentHeader.length === headerRow.length && currentHeader.every((v, i) => v === headerRow[i]);

  if (!headerMatches) {
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: 'RAW',
      requestBody: { values: [headerRow] },
    });
  }
}

module.exports = { ensureTab };
