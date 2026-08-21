// Batch-appends rows to a tab in one API call (not row-by-row) to minimize
// requests against the Sheets API's per-minute rate limit.
async function appendRows(sheetsClient, spreadsheetId, tabName, rows) {
  if (!rows || rows.length === 0) return;

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

module.exports = { appendRows };
