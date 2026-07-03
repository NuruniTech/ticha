import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Shared helpers for API routes that write on behalf of a parent.
//
// Pattern: identify the parent from their session cookie, verify the child
// belongs to them THROUGH the user-scoped client (RLS enforces ownership),
// then perform writes with the service-role client. This lets us revoke
// direct client-side write privileges on XP/session tables (see the
// "Server-authoritative XP" section of lib/schema.sql) without breaking
// the app.

export async function getAuthedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}

// Verifies childId belongs to the authenticated caller (via RLS) and returns
// the child's XP/streak state, or null if not found / not theirs.
export async function getOwnedChild(userClient: SupabaseClient, childId: string) {
  const { data } = await userClient
    .from("children")
    .select("id, xp, streak, last_session_at")
    .eq("id", childId)
    .single();
  return data as { id: string; xp: number; streak: number; last_session_at: string | null } | null;
}

export function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
