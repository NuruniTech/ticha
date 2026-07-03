import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Protects authenticated areas: anyone without a Supabase session is
// redirected to /login. Public: landing, demo, auth pages, legal pages.
// Also refreshes the auth token cookie on every matched request, which
// keeps long-lived parent sessions from silently expiring.

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/child",
  "/session",
  "/settings",
  "/progress",
  "/quiz",
  "/onboarding",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() validates the JWT against Supabase — do not replace
  // with getSession(), which trusts the cookie without verification.
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/")
  );

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip static assets and images; API routes do their own auth checks
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|images|.*\\.(?:png|jpg|svg|js|json|html)$).*)"],
};
