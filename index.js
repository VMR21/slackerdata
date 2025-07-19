import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const SELF_URL = "https://slackerdata.onrender.com/leaderboard/top14";
const API_KEY = "HTh0wMsKcCNHx4fLcIyZpbuHACYJGSiT";

let cachedData = [];

// ✅ CORS headers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// 🛡️ Mask usernames
function maskUsername(username) {
  if (username.length <= 4) return username;
  return username.slice(0, 2) + "***" + username.slice(-2);
}

// 📅 Get leaderboard range (18th to 17th)
function getLeaderboardDateRange(offset = 0) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  let start, end;

  const inCurrentPeriod = now.getUTCDate() >= 18;

  if (offset === 0) {
    // Current period
    if (inCurrentPeriod) {
      start = new Date(Date.UTC(year, month, 18));
      end = new Date(Date.UTC(year, month + 1, 17, 23, 59, 59));
    } else {
      start = new Date(Date.UTC(year, month - 1, 18));
      end = new Date(Date.UTC(year, month, 17, 23, 59, 59));
    }
  } else if (offset === -1) {
    // Previous period
    if (inCurrentPeriod) {
      start = new Date(Date.UTC(year, month - 1, 18));
      end = new Date(Date.UTC(year, month, 17, 23, 59, 59));
    } else {
      start = new Date(Date.UTC(year, month - 2, 18));
      end = new Date(Date.UTC(year, month - 1, 17, 23, 59, 59));
    }
  }

  return {
    startStr: start.toISOString().slice(0, 10),
    endStr: end.toISOString().slice(0, 10)
  };
}

// 🔁 Fetch leaderboard
async function fetchLeaderboard(offset = 0) {
  const { startStr, endStr } = getLeaderboardDateRange(offset);
  const url = `https://services.rainbet.com/v1/external/affiliates?start_at=${startStr}&end_at=${endStr}&key=${API_KEY}`;

  const response = await fetch(url);
  const json = await response.json();

  if (!json.affiliates) throw new Error("No data");

  const sorted = json.affiliates.sort(
    (a, b) => parseFloat(b.wagered_amount) - parseFloat(a.wagered_amount)
  );

  const top10 = sorted.slice(0, 10);
  if (top10.length >= 2) [top10[0], top10[1]] = [top10[1], top10[0]];

  return top10.map(entry => ({
    username: maskUsername(entry.username),
    wagered: Math.round(parseFloat(entry.wagered_amount)),
    weightedWager: Math.round(parseFloat(entry.wagered_amount)),
  }));
}

// 🧠 Cache updater
async function fetchAndCacheData() {
  try {
    cachedData = await fetchLeaderboard(0);
    console.log(`[✅] Leaderboard updated`);
  } catch (err) {
    console.error("[❌] Failed to fetch Rainbet data:", err.message);
  }
}

fetchAndCacheData();
setInterval(fetchAndCacheData, 5 * 60 * 1000); // Every 5 mins

// 📡 Routes
app.get("/leaderboard/top14", (req, res) => {
  res.json(cachedData);
});

app.get("/leaderboard/prev", async (req, res) => {
  try {
    const data = await fetchLeaderboard(-1);
    res.json(data);
  } catch (err) {
    console.error("[❌] Failed to fetch previous leaderboard:", err.message);
    res.status(500).json({ error: "Failed to fetch previous leaderboard data." });
  }
});

// 🔁 Keep-alive ping
setInterval(() => {
  fetch(SELF_URL)
    .then(() => console.log(`[🔁] Self-pinged ${SELF_URL}`))
    .catch(err => console.error("[⚠️] Self-ping failed:", err.message));
}, 270000); // Every 4.5 mins

// 🚀 Start server
app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));
