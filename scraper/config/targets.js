// Properties and suburbs tracked by the weekly scraper (scraper/run.js).
// Add/remove entries here to change what gets tracked - no other file needs editing.

module.exports = {
  properties: [
    {
      address: '6C Walker Avenue, Rockingham WA 6168',
      suburb: 'Rockingham',
      state: 'WA',
      postcode: '6168',
    },
    {
      address: '9 Tranmere Street, Fitzroy North VIC 3068',
      suburb: 'Fitzroy North',
      state: 'VIC',
      postcode: '3068',
    },
    {
      address: '108A Safety Bay Road, Shoalwater WA 6169',
      suburb: 'Shoalwater',
      state: 'WA',
      postcode: '6169',
    },
  ],

  // Suburb coverage is independent of the properties list above - a suburb can
  // have zero or multiple tracked properties, and stays tracked even if a
  // property is removed.
  suburbs: [
    { suburb: 'Rockingham', state: 'WA', postcode: '6168' },
    { suburb: 'Fitzroy North', state: 'VIC', postcode: '3068' },
    { suburb: 'Shoalwater', state: 'WA', postcode: '6169' },
  ],

  // Combined with each suburb name to build the Google News RSS query.
  newsKeywords: ['property market', 'house prices', 'real estate'],
};
