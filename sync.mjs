/**
 * OTT → Trakt Auto-Sync (Headless)
 *
 * Standalone Node.js script that fetches trending/popular movies and TV shows
 * from JustWatch and pushes them to Trakt custom lists.
 *
 * Designed to run in GitHub Actions on a cron schedule.
 *
 * Required environment variables (GitHub Secrets):
 *   TRAKT_CLIENT_ID
 *   TRAKT_CLIENT_SECRET
 *   TRAKT_ACCESS_TOKEN
 *   TRAKT_REFRESH_TOKEN  (optional, used for auto-refresh on 401)
 */

import { readFileSync } from "node:fs";

// ─── Configuration ──────────────────────────────────────────────────────────

function loadConfig() {
  const raw = readFileSync(new URL("./config.json", import.meta.url), "utf-8");
  const config = JSON.parse(raw);

  // Validate required fields
  if (!config.username || config.username === "YOUR_TRAKT_USERNAME") {
    throw new Error(
      "Please set your Trakt username in config.json before running."
    );
  }
  if (!Array.isArray(config.platforms) || config.platforms.length === 0) {
    throw new Error("No platforms configured in config.json.");
  }

  const itemsCount = Number(config.itemsCount);
  if (!Number.isFinite(itemsCount) || itemsCount < 1 || itemsCount > 200) {
    throw new Error("itemsCount must be a number between 1 and 200.");
  }
  config.itemsCount = itemsCount;

  const validSorts = ["POPULAR", "TRENDING", "BOTH_MERGED"];
  if (!validSorts.includes(config.sortBy)) {
    throw new Error(
      `sortBy must be one of: ${validSorts.join(", ")}. Got: ${config.sortBy}`
    );
  }

  return config;
}

function loadSecrets() {
  const clientId = process.env.TRAKT_CLIENT_ID;
  const clientSecret = process.env.TRAKT_CLIENT_SECRET;
  const accessToken = process.env.TRAKT_ACCESS_TOKEN;
  const refreshToken = process.env.TRAKT_REFRESH_TOKEN || "";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing TRAKT_CLIENT_ID or TRAKT_CLIENT_SECRET environment variables."
    );
  }
  if (!accessToken) {
    throw new Error(
      "Missing TRAKT_ACCESS_TOKEN environment variable. " +
        "Get one from the dashboard or via Trakt OAuth."
    );
  }

  return { clientId, clientSecret, accessToken, refreshToken };
}

// ─── Logging ────────────────────────────────────────────────────────────────

function log(message, level = "INFO") {
  const timestamp = new Date().toISOString();
  const prefix = { INFO: "ℹ️ ", SUCCESS: "✅", ERROR: "❌", WARN: "⚠️ " };
  console.log(`[${timestamp}] ${prefix[level] || ""} ${message}`);
}

// ─── JustWatch GraphQL ──────────────────────────────────────────────────────

async function fetchJustWatchType(packageCode, type, count, config) {
  const fetchWithSort = async (sortValue) => {
    const query = `
      query GetPopularTitles(
        $country: Country!,
        $popularTitlesFilter: TitleFilter,
        $popularTitlesSortBy: PopularTitlesSorting! = ${sortValue},
        $first: Int! = ${count},
        $language: Language!
      ) {
        popularTitles(
          country: $country,
          filter: $popularTitlesFilter,
          sortBy: $popularTitlesSortBy,
          first: $first
        ) {
          edges {
            node {
              content(country: $country, language: $language) {
                title
                fullPath
                posterUrl
                externalIds { tmdbId imdbId }
              }
            }
          }
        }
      }`;

    const payload = {
      operationName: "GetPopularTitles",
      variables: {
        country: config.country || "IN",
        language: config.language || "en",
        first: count,
        popularTitlesFilter: {
          packages: [packageCode],
          objectTypes: [type],
          monetizationTypes: ["FLATRATE", "FREE", "ADS"],
        },
        popularTitlesSortBy: sortValue,
      },
      query,
    };

    // Server-side: call JustWatch directly, no CORS proxy needed
    const response = await fetch("https://apis.justwatch.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ott-to-trakt-sync/1.0",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `JustWatch API Error: ${response.status} - ${errText}`
      );
    }

    const data = await response.json();
    const edges = data.data?.popularTitles?.edges || [];

    return edges
      .map((edge) => {
        const content = edge.node?.content || {};
        return {
          title: content.title,
          fullPath: content.fullPath,
          posterUrl: content.posterUrl,
          tmdb_id: content.externalIds?.tmdbId,
          imdb_id: content.externalIds?.imdbId,
        };
      })
      .filter((item) => item.tmdb_id || item.imdb_id);
  };

  if (config.sortBy === "BOTH_MERGED") {
    const [popular, trending] = await Promise.all([
      fetchWithSort("POPULAR"),
      fetchWithSort("TRENDING"),
    ]);
    const merged = [...popular, ...trending];
    const unique = [];
    const seen = new Set();
    for (const item of merged) {
      const key = item.tmdb_id
        ? `tmdb_${item.tmdb_id}`
        : `imdb_${item.imdb_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }
    return unique;
  }

  return fetchWithSort(config.sortBy);
}

// ─── Trakt API ──────────────────────────────────────────────────────────────

async function refreshTraktToken(secrets) {
  if (!secrets.refreshToken) {
    throw new Error(
      "Access token expired and no TRAKT_REFRESH_TOKEN is set. " +
        "Please update TRAKT_ACCESS_TOKEN in GitHub Secrets."
    );
  }

  log("Access token expired. Attempting refresh...", "WARN");

  const response = await fetch("https://api.trakt.tv/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "ott-to-trakt-sync/1.0",
    },
    body: JSON.stringify({
      refresh_token: secrets.refreshToken,
      client_id: secrets.clientId,
      client_secret: secrets.clientSecret,
      redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Token refresh failed (${response.status}): ${errText}. ` +
        "Please generate a new token via the dashboard and update GitHub Secrets."
    );
  }

  const data = await response.json();
  log("Token refreshed successfully!", "SUCCESS");
  log(
    "ACTION REQUIRED: Update these GitHub Secrets for future runs:",
    "WARN"
  );
  log(`  TRAKT_ACCESS_TOKEN  = ${data.access_token}`, "WARN");
  log(`  TRAKT_REFRESH_TOKEN = ${data.refresh_token}`, "WARN");

  return data.access_token;
}

function traktHeaders(clientId, accessToken) {
  return {
    "Content-Type": "application/json",
    "User-Agent": "ott-to-trakt-sync/1.0",
    "trakt-api-version": "2",
    "trakt-api-key": clientId,
    Authorization: `Bearer ${accessToken}`,
  };
}

async function pushToTrakt(movies, shows, listSlug, config, secrets, token) {
  const headers = traktHeaders(secrets.clientId, token);
  const baseUrl = `https://api.trakt.tv/users/${config.username.trim()}/lists/${listSlug.trim()}/items`;

  // 1. Check existing items and clear
  log(`  Checking existing items in '${listSlug}'...`);
  const getRes = await fetch(baseUrl, { method: "GET", headers });

  if (getRes.status === 404) {
    throw new Error(
      `List '${listSlug}' not found. Create it on Trakt first.`
    );
  }
  if (getRes.status === 401) {
    // Token might be expired — caller handles refresh
    const err = new Error("Trakt token expired");
    err.code = "TOKEN_EXPIRED";
    throw err;
  }
  if (!getRes.ok) {
    throw new Error(`Failed to fetch list '${listSlug}': ${getRes.status}`);
  }

  const existingItems = await getRes.json();

  if (existingItems && existingItems.length > 0) {
    log(`  Clearing ${existingItems.length} old items...`);
    const removePayload = { movies: [], shows: [] };
    for (const item of existingItems) {
      if (item.type === "movie" && item.movie)
        removePayload.movies.push({ ids: item.movie.ids });
      if (item.type === "show" && item.show)
        removePayload.shows.push({ ids: item.show.ids });
    }

    const removeRes = await fetch(`${baseUrl}/remove`, {
      method: "POST",
      headers,
      body: JSON.stringify(removePayload),
    });

    if (!removeRes.ok) {
      log(`  Warning: Failed to clear old items perfectly.`, "WARN");
    } else {
      log(`  Old items cleared.`, "SUCCESS");
    }
  } else {
    log(`  List is already empty.`);
  }

  // 2. Push fresh items
  log(`  Pushing ${movies.length} movies + ${shows.length} shows...`);
  const formatPayload = (items) =>
    items.map((i) => {
      const ids = {};
      if (i.tmdb_id) ids.tmdb = i.tmdb_id;
      else if (i.imdb_id) ids.imdb = i.imdb_id;
      return { ids };
    });

  const addRes = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      movies: formatPayload(movies),
      shows: formatPayload(shows),
    }),
  });

  if (!addRes.ok) {
    const errText = await addRes.text();
    throw new Error(`Trakt push error ${addRes.status}: ${errText}`);
  }

  const result = await addRes.json();
  const addedMovies = result.added?.movies || 0;
  const addedShows = result.added?.shows || 0;
  log(
    `  ✓ ${listSlug}: Added ${addedMovies} movies, ${addedShows} shows.`,
    "SUCCESS"
  );
}

// ─── Sync Orchestration ─────────────────────────────────────────────────────

async function syncPlatform(platform, config, secrets, token) {
  log(`Fetching top ${config.itemsCount} Movies for ${platform.name}...`);
  const movies = await fetchJustWatchType(
    platform.package,
    "MOVIE",
    config.itemsCount,
    config
  );

  log(`Fetching top ${config.itemsCount} TV Shows for ${platform.name}...`);
  const shows = await fetchJustWatchType(
    platform.package,
    "SHOW",
    config.itemsCount,
    config
  );

  if (movies.length > 0 || shows.length > 0) {
    await pushToTrakt(movies, shows, platform.listSlug, config, secrets, token);
  } else {
    log(`No content found for ${platform.name}. Skipping.`, "WARN");
  }
}

async function main() {
  log("═══════════════════════════════════════════════════════");
  log("  OTT → Trakt Auto-Sync Starting");
  log("═══════════════════════════════════════════════════════");

  const config = loadConfig();
  const secrets = loadSecrets();
  let token = secrets.accessToken;

  log(`User: ${config.username}`);
  log(`Region: ${config.country} / ${config.language}`);
  log(`Sort: ${config.sortBy} | Items per type: ${config.itemsCount}`);
  log(`Platforms: ${config.platforms.map((p) => p.name).join(", ")}`);
  log("");

  let totalSuccess = 0;
  let totalFailed = 0;
  let tokenRefreshed = false;

  for (const platform of config.platforms) {
    log(`═══ Syncing ${platform.name} ═══`);
    try {
      await syncPlatform(platform, config, secrets, token);
      totalSuccess++;
    } catch (err) {
      // Handle token expiry: refresh once and retry
      if (err.code === "TOKEN_EXPIRED" && !tokenRefreshed) {
        try {
          token = await refreshTraktToken(secrets);
          tokenRefreshed = true;
          // Retry this platform with the new token
          await syncPlatform(platform, config, secrets, token);
          totalSuccess++;
          continue;
        } catch (refreshErr) {
          log(`FATAL: ${refreshErr.message}`, "ERROR");
          totalFailed++;
          continue;
        }
      }
      log(`Error syncing ${platform.name}: ${err.message}`, "ERROR");
      totalFailed++;
    }
  }

  log("");
  log("═══════════════════════════════════════════════════════");
  log(
    `  Sync Complete — ${totalSuccess} succeeded, ${totalFailed} failed`,
    totalFailed > 0 ? "WARN" : "SUCCESS"
  );
  log("═══════════════════════════════════════════════════════");

  // Exit with error code if any platform failed
  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  log(`FATAL: ${err.message}`, "ERROR");
  process.exit(1);
});
