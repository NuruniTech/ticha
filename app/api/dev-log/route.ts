import { NextResponse } from "next/server";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// DEV ONLY. While testing on localhost, the session screen streams its debug log
// here so it lands in .debug/session.log (git-ignored) and can be read straight
// from disk, instead of being copied out of the browser by hand. It answers 404
// in any non-development build, so it does not exist in production.

const DIR = path.join(process.cwd(), ".debug");
const FILE = path.join(DIR, "session.log");
const MAX_LINES = 200;
const MAX_LINE_LEN = 2000;

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return new NextResponse(null, { status: 404 });

  let body: { lines?: unknown; reset?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  await mkdir(DIR, { recursive: true });
  if (body.reset === true) await writeFile(FILE, "");

  const lines = Array.isArray(body.lines)
    ? body.lines.filter((l): l is string => typeof l === "string").slice(0, MAX_LINES).map((l) => l.slice(0, MAX_LINE_LEN))
    : [];
  if (lines.length) await appendFile(FILE, lines.join("\n") + "\n");
  return NextResponse.json({ ok: true, written: lines.length });
}
