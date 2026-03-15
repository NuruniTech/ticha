import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get("code");
  const next  = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Ensure profile row exists
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: data.user.email ?? "",
        full_name: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? "",
      }, { onConflict: "id" });

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong — send to login with error
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
