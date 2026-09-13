/**
 * scripts/simulate-burst.ts
 *
 * Generates a synthetic burst of near-duplicate submissions against a target
 * geo-cluster (local/staging ONLY — never run against production) to test
 * burstDetection.ts's response without waiting for real abusive traffic.
 *
 * Usage: tsx simulate-burst.ts --lat=28.6139 --lng=77.2090 --category=roads --count=20 --windowMinutes=10
 */

type Args = { lat: number; lng: number; category: string; count: number; windowMinutes: number; apiBaseUrl: string };

function parseArgs(): Args {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v];
    })
  );
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8080";
  if (apiBaseUrl.includes("prod")) {
    throw new Error("Refusing to run simulate-burst.ts against a production-looking API_BASE_URL.");
  }
  return {
    lat: parseFloat(args.lat ?? "28.6139"),
    lng: parseFloat(args.lng ?? "77.2090"),
    category: args.category ?? "roads",
    count: parseInt(args.count ?? "20", 10),
    windowMinutes: parseInt(args.windowMinutes ?? "10", 10),
    apiBaseUrl,
  };
}

async function jitter(lat: number, lng: number) {
  // Small jitter (~within 50m) so submissions land in the same geo-cluster
  // without being byte-identical.
  return { lat: lat + (Math.random() - 0.5) * 0.0004, lng: lng + (Math.random() - 0.5) * 0.0004 };
}

async function main() {
  const { lat, lng, category, count, windowMinutes, apiBaseUrl } = parseArgs();
  console.log(`Simulating ${count} near-duplicate "${category}" submissions near (${lat}, ${lng}) over ~${windowMinutes} min.`);
  console.log(`Target: ${apiBaseUrl} — confirm this is local/staging before proceeding.`);

  for (let i = 0; i < count; i++) {
    const point = await jitter(lat, lng);
    const body = {
      channel: "web",
      text: `Test burst submission #${i + 1} — ${category} issue reported for burst-detection testing`,
      lat: point.lat,
      lng: point.lng,
    };
    const res = await fetch(`${apiBaseUrl}/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    console.log(`  #${i + 1}: ${res.status}`);
    // Spread submissions across the window rather than firing all at once.
    await new Promise((r) => setTimeout(r, (windowMinutes * 60 * 1000) / count));
  }

  console.log("Done. Check the target geo-cluster's Issue status — it should be flagged for review, not silently ranked.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
