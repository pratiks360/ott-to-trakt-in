fetch('https://corsproxy.io/?https://apis.justwatch.com/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Origin': 'https://pratiks360.github.io'
  },
  body: JSON.stringify({
    "operationName": "GetPopularTitles",
    "variables": {
      "country": "IN",
      "language": "en",
      "first": 1,
      "popularTitlesFilter": {"packages": ["nfx"], "objectTypes": ["MOVIE"]},
      "popularTitlesSortBy": "TRENDING"
    },
    "query": "query GetPopularTitles($country: Country!, $popularTitlesFilter: TitleFilter, $popularTitlesSortBy: PopularTitlesSorting! = TRENDING, $first: Int! = 40, $language: Language!) { popularTitles(country: $country, filter: $popularTitlesFilter, sortBy: $popularTitlesSortBy, first: $first) { edges { node { content(country: $country, language: $language) { title externalIds { tmdbId imdbId } } } } } }"
  })
})
.then(r => r.text())
.then(text => console.log("SUCCESS:", text))
.catch(err => console.error("ERROR:", err));
