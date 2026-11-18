// The teletext-style pages. One place to change a page's number, title or scope.
export const PAGES = {
  100: { title: 'Portugal', slug: 'portugal', about: 'Portugal as a whole: weather warnings, forecasts for the main cities, and the latest PrompTugal.news articles on Portugal.' },
  200: { title: 'The Algarve', slug: 'algarve', about: 'The Algarve: forecasts, warnings and sea for Faro district, flights around Faro airport, and the latest Algarve articles.' },
  300: { title: 'Lisbon', slug: 'lisbon', about: 'Lisbon: forecast, warnings and sea, and the latest Lisbon articles.' },
  400: { title: 'Summit and tech', slug: 'summit-and-tech', about: 'The summit and technology: the latest articles on the summit and AI, and the library\'s catalogue and fact-checker.' },
  500: { title: 'Weather', slug: 'weather', about: 'Weather across Portugal from IPMA: warnings, forecasts, sea and fire risk.' },
  600: { title: 'Data', slug: 'data', about: 'data.promptugal.news: each public source we read, when it was last read and what it holds.' },
  700: { title: 'London', slug: 'london', about: 'Beyond Portugal: London, the first place outside Portugal (Dinis, 18 November 2026). Built from London data on data.promptugal.news: the Open-Meteo forecast (Weather data by Open-Meteo.com, CC BY 4.0, used under its free non-commercial terms), Environment Agency flood warnings and river data, and the London sources the data site reads. Not a warning service: follow the Environment Agency and the Met Office.', waiting: 'No London data has landed on data.promptugal.news yet. This page fills itself when the first London source is published.' },
  800: { title: 'Our newsroom', slug: 'newsroom', about: 'What the PrompTugal.news agents did: commits, status files and the telemetry counts.' },
};
