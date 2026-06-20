// This file is intentionally empty.
// Bot detection is now handled by /api/og.js edge function.
// Static sites on Vercel don't support Edge Middleware.
export default function middleware(){}
export const config = { matcher: [] };
