// Netlify scheduled function that triggers a site rebuild daily.
// The rebuild runs fetch + summarize + astro build via the build command in netlify.toml.

export default async function handler() {
  const hookUrl = process.env.BUILD_HOOK_URL;
  if (!hookUrl) {
    return new Response(JSON.stringify({ error: 'BUILD_HOOK_URL not set' }), { status: 500 });
  }

  const res = await fetch(hookUrl, { method: 'POST' });
  console.log(`Build triggered: ${res.status}`);

  return new Response(JSON.stringify({ triggered: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// DISABLED: Manual updates via Claude Code. Scheduled builds deploy stale content.
// export const config = {
//   schedule: '0 9 * * *', // 5am EDT / 4am EST (09:00 UTC)
// };
