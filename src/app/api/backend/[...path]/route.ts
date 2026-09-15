/**
 * Catch-all proxy: /api/backend/[...path] -> BACKEND_URL/[...path]
 * Keeps BACKEND_URL server-side; the browser never sees it.
 */
import { type NextRequest, NextResponse } from "next/server";

/**
 * Unset in production means "there is no passkey service", not localhost.
 *
 * There is no localhost default. A deployed build fell back to it and answered
 * ECONNREFUSED 127.0.0.1:3001 from inside the serverless function -- a default
 * that is only ever right on the machine it was written on. Set BACKEND_URL in
 * .env.local for local work. Only the
 * WebAuthn endpoints come through here now -- reads and submissions go straight
 * to Soroban RPC from the browser -- so an unset BACKEND_URL is a supported
 * configuration and should say so.
 */
const BACKEND = process.env.BACKEND_URL ?? "";

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

/**
 * Only the headers that mean something to the backend are forwarded.
 *
 * This used to copy the whole incoming Headers object and stream `req.body`
 * with duplex: "half". That sends the browser's `content-length`,
 * `accept-encoding`, `connection` and Vercel's own `x-forwarded-*` upstream,
 * and a content-length that no longer matches a re-encoded body makes fetch
 * throw -- so every proxied call answered 500 before it reached the backend.
 * Reading the body to a string and declaring only what we mean also avoids
 * the streaming path entirely; these requests are a few hundred bytes.
 */
const FORWARD = ["content-type", "authorization", "accept"];

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

  const url = `${BACKEND}/${params.path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARD) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.text() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(url, { method: req.method, headers, body });
  } catch (e) {
    // A backend that is down is a 502 from the proxy, not a 500 from us.
    return NextResponse.json(
      { error: `Could not reach the backend at ${BACKEND}: ${detail(e)}` },
      { status: 502 },
    );
  }

  // Pass the body through as text. Copying upstream's content-encoding and
  // content-length alongside a body fetch has already decoded produces a
  // response the browser cannot read.
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

/** fetch() wraps the real reason in `cause`; without it every failure is "fetch failed". */
function detail(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cause = (e as { cause?: unknown }).cause;
  return cause ? `${e.message}: ${cause instanceof Error ? cause.message : String(cause)}` : e.message;
}
