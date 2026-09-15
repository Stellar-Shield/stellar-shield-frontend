/**
 * Catch-all proxy: /api/backend/[...path] → BACKEND_URL/[...path]
 * Keeps BACKEND_URL server-side; the browser never sees it.
 */
import { type NextRequest, NextResponse } from "next/server";

/**
 * Unset in production means "there is no passkey service", not localhost.
 *
 * Defaulting to localhost on a deployed instance produced a connection refused
 * from inside the serverless function and a 500 with no explanation. Only the
 * WebAuthn endpoints come through here now -- reads and submissions go straight
 * to Soroban RPC from the browser -- so an unset BACKEND_URL is a supported
 * configuration and should say so.
 */
const BACKEND =
  process.env.BACKEND_URL ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:3001");

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}

async function proxy(req: NextRequest, params: { path: string[] }) {
  if (!BACKEND) {
    return NextResponse.json(
      {
        error:
          "Passkey registration is not available on this deployment: BACKEND_URL is not set. " +
          "Setting and spending limits work without it.",
      },
      { status: 503 },
    );
  }

  const tail = params.path.join("/");
  const search = req.nextUrl.search;
  const url = `${BACKEND}/${tail}${search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    // @ts-expect-error — Node 18+ fetch supports duplex
    duplex: "half",
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}
