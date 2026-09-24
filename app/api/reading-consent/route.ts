import { NextResponse } from "next/server";
import { getAuthedUser, getOwnedChild, serviceClient } from "@/lib/apiAuth";

// Records that a parent consents to their child's reading results being
// stored and used to measure learning. Parents cannot write this column
// directly (children updates are limited to profile fields), so it goes
// through the server after an ownership check.
export async function POST(request: Request) {
  const { user, supabase: userClient } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { childId?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  if (typeof body.childId !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const child = await getOwnedChild(userClient, body.childId);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await serviceClient()
    .from("children")
    .update({ reading_consent_at: new Date().toISOString() })
    .eq("id", body.childId);
  if (error) {
    console.error("reading-consent update failed:", error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
