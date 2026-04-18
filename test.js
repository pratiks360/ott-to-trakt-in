fetch('https://apis.justwatch.com/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    "operationName": "GetPopularTitles",
    "variables": {
      "country": "IN",
      "language": "en",
      "first": 2,
      "popularTitlesFilter": {"packages": ["nfx"], "objectTypes": ["MOVIE"]},
      "popularTitlesSortBy": "TRENDING"
    },
    "query": "query GetPopularTitles($country: Country!, $popularTitlesFilter: TitleFilter, $popularTitlesSortBy: PopularTitlesSorting! = TRENDING, $first: Int! = 40, $language: Language!) { popularTitles(country: $country, filter: $popularTitlesFilter, sortBy: $popularTitlesSortBy, first: $first) { edges { node { content(country: $country, language: $language) { title posterUrl fullPath externalIds { tmdbId imdbId } } } } } }"
  })
})
.then(r => r.json())
.then(json => console.log(JSON.stringify(json, null, 2)))
.catch(err => console.error("ERROR:", err));
