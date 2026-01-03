import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * api versioning middleware for mobile app support.
 *
 * mobile apps call versioned endpoints (e.g., /api/v1/chat) while
 * web app continues using unversioned endpoints (e.g., /api/chat).
 *
 * when a breaking change is needed:
 * 1. create new v2 route handlers in app/api/v2/*
 * 2. update this middleware to route v2 traffic appropriately
 * 3. keep v1 routes working until mobile adoption drops
 */

// current stable api version
const CURRENT_API_VERSION = "v1";

// supported api versions
const SUPPORTED_VERSIONS = ["v1"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // match /api/v{n}/* patterns
  const versionMatch = pathname.match(/^\/api\/(v\d+)(\/.*)?$/);

  if (versionMatch) {
    const version = versionMatch[1];
    const restOfPath = versionMatch[2] || "";

    // check if version is supported
    if (!SUPPORTED_VERSIONS.includes(version)) {
      return NextResponse.json(
        {
          error: "Unsupported API version",
          supportedVersions: SUPPORTED_VERSIONS,
          currentVersion: CURRENT_API_VERSION,
        },
        { status: 400 }
      );
    }

    // rewrite /api/v1/chat → /api/chat (for now, all v1 routes map to current)
    const newUrl = request.nextUrl.clone();
    newUrl.pathname = `/api${restOfPath}`;

    const response = NextResponse.rewrite(newUrl);

    // add version header for debugging/logging
    response.headers.set("X-API-Version", version);

    return response;
  }

  return NextResponse.next();
}

export const config = {
  // only run on api routes
  matcher: "/api/:path*",
};
