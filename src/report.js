/**
 * Report generation — fetches history from Tautulli, aggregates per-user stats,
 * and formats a text report.
 */

/**
 * Format seconds into a human-readable duration string.
 * @param {number} seconds
 * @returns {string} e.g. "2hr 15min"
 */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0min";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}hr ${minutes}min`;
  if (hours > 0) return `${hours}hr`;
  return `${minutes}min`;
}

/**
 * Format a date as "Mon DD" (e.g. "Mar 9").
 * @param {Date} date
 * @returns {string}
 */
function formatShortDate(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format a date as "YYYY-MM-DD" for the API.
 * @param {Date} date
 * @returns {string}
 */
function toAPIDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Generate a weekly report.
 * @param {import('./api.js').TautulliAPI} api
 * @param {number} [days=7] - Number of days to look back
 * @returns {Promise<{subject: string, body: string}>}
 */
export async function generateReport(api, days = 7) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const after = toAPIDate(startDate);
  const before = toAPIDate(now);

  // Fetch all history for the period
  const history = await api.getHistoryAll({ after, before });

  // Build per-user aggregation
  /** @type {Map<string, { movies: Map<string, number>, shows: Map<string, Map<string, {season: number, count: number}>>, tracks: number, totalDuration: number, movieCount: number, episodeCount: number, trackCount: number }>} */
  const userStats = new Map();

  for (const entry of history) {
    const userName = entry.friendly_name || entry.user || "Unknown";
    if (!userStats.has(userName)) {
      userStats.set(userName, {
        movies: new Map(), // title -> duration in seconds
        shows: new Map(), // grandparent_title -> Map<season, {season, count}>
        tracks: new Map(), // title -> count
        totalDuration: 0,
        movieCount: 0,
        episodeCount: 0,
        trackCount: 0,
      });
    }

    const stats = userStats.get(userName);
    const duration = entry.play_duration || entry.duration || 0;
    stats.totalDuration += duration;

    switch (entry.media_type) {
      case "movie": {
        stats.movieCount++;
        const title = entry.full_title || entry.title || "Unknown Movie";
        const year = entry.year ? ` (${entry.year})` : "";
        const key = `${title}${year}`;
        stats.movies.set(key, (stats.movies.get(key) || 0) + duration);
        break;
      }
      case "episode": {
        stats.episodeCount++;
        const showName =
          entry.grandparent_title || entry.full_title || "Unknown Show";
        const season = entry.parent_media_index || 0;

        if (!stats.shows.has(showName)) {
          stats.shows.set(showName, new Map());
        }
        const seasons = stats.shows.get(showName);
        const seasonKey = `S${String(season).padStart(2, "0")}`;
        if (!seasons.has(seasonKey)) {
          seasons.set(seasonKey, { season, count: 0 });
        }
        seasons.get(seasonKey).count++;
        break;
      }
      case "track": {
        stats.trackCount++;
        const trackTitle =
          entry.grandparent_title || entry.title || "Unknown Track";
        stats.tracks.set(trackTitle, (stats.tracks.get(trackTitle) || 0) + 1);
        break;
      }
    }
  }

  // Build the report text
  const dateRange = `${formatShortDate(startDate)} – ${formatShortDate(now)}, ${now.getFullYear()}`;
  const subject = `Plex Weekly Report (${dateRange})`;

  const lines = [];
  lines.push(`📺 Plex Weekly Report (${dateRange})`);
  lines.push("═".repeat(50));
  lines.push("");

  if (userStats.size === 0) {
    lines.push("No activity recorded this period.");
  }

  let totalServerMovies = 0;
  let totalServerEpisodes = 0;
  let totalServerTracks = 0;
  let totalServerDuration = 0;

  // Sort users by total duration (descending), then alphabetically as a fallback
  const sortedUsers = [...userStats.entries()].sort((a, b) => {
    const diff = b[1].totalDuration - a[1].totalDuration;
    if (diff !== 0) return diff;
    return a[0].localeCompare(b[0]);
  });

  for (const [userName, stats] of sortedUsers) {
    totalServerMovies += stats.movieCount;
    totalServerEpisodes += stats.episodeCount;
    totalServerTracks += stats.trackCount;
    totalServerDuration += stats.totalDuration;

    lines.push(`👤 ${userName}`);

    const parts = [];
    if (stats.movieCount > 0)
      parts.push(`Movies: ${stats.movieCount}`);
    if (stats.episodeCount > 0)
      parts.push(`Episodes: ${stats.episodeCount}`);
    if (stats.trackCount > 0)
      parts.push(`Tracks: ${stats.trackCount}`);
    lines.push(`   ${parts.join("  |  ")}`);
    lines.push(`   ${"─".repeat(40)}`);

    // Movies
    if (stats.movies.size > 0) {
      lines.push("   🎬 Movies:");
      for (const [title, dur] of stats.movies) {
        lines.push(`      • ${title} (${formatDuration(dur)})`);
      }
    }

    // TV Shows
    if (stats.shows.size > 0) {
      lines.push("   📺 TV Shows:");
      for (const [showName, seasons] of stats.shows) {
        const seasonParts = [];
        for (const [seasonKey, info] of seasons) {
          seasonParts.push(
            `${seasonKey} — ${info.count} episode${info.count !== 1 ? "s" : ""}`
          );
        }
        lines.push(`      • ${showName} (${seasonParts.join(", ")})`);
      }
    }

    // Music
    if (stats.tracks.size > 0) {
      lines.push("   🎵 Music:");
      for (const [artist, count] of stats.tracks) {
        lines.push(
          `      • ${artist} (${count} track${count !== 1 ? "s" : ""})`
        );
      }
    }

    lines.push(`   ⏱ Total Watch Time: ${formatDuration(stats.totalDuration)}`);
    lines.push("");
  }

  // Server totals
  lines.push("═".repeat(50));
  const totalParts = [];
  if (totalServerMovies > 0)
    totalParts.push(
      `${totalServerMovies} movie${totalServerMovies !== 1 ? "s" : ""}`
    );
  if (totalServerEpisodes > 0)
    totalParts.push(
      `${totalServerEpisodes} episode${totalServerEpisodes !== 1 ? "s" : ""}`
    );
  if (totalServerTracks > 0)
    totalParts.push(
      `${totalServerTracks} track${totalServerTracks !== 1 ? "s" : ""}`
    );

  if (totalParts.length > 0) {
    lines.push(`📊 Server Totals: ${totalParts.join(", ")}`);
  }
  lines.push(
    `⏱  Total Server Watch Time: ${formatDuration(totalServerDuration)}`
  );

  return {
    subject,
    body: lines.join("\n"),
  };
}
