import { NextResponse } from "next/server";

import { ANONYMOUS_AVATAR_SRC } from "@/lib/anonymous-prayer-avatar";

// This route used to generate a per-seed SVG of a haloed figure for every
// anonymous responder. That artwork has been retired in favour of the site
// logo. The route is kept as a redirect so any page still holding an old
// `?seed=` URL (cached HTML, an open tab) renders the new avatar instead of
// 404-ing; nothing in the app builds these URLs any more.
export function GET(request) {
  return NextResponse.redirect(new URL(ANONYMOUS_AVATAR_SRC, request.nextUrl.origin), 308);
}
