import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

// This route is called by Vercel Cron every Sunday at 8am EAT (5am UTC)
// Requires: RESEND_API_KEY in env
// Uses service role key to query all parents (bypasses RLS)

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Instantiate SDK clients inside the handler so they only run at request time,
  // not during Next.js build-time module evaluation.
  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  // Verify this is called by Vercel Cron (or manually with the secret)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Get all parents who have children with activity in the last 7 days
    const { data: activeChildren } = await supabaseAdmin
      .from("children")
      .select("id, name, avatar, xp, streak, parent_id")
      .gte("last_session_at", oneWeekAgo);

    if (!activeChildren || activeChildren.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    // Group children by parent
    const byParent: Record<string, typeof activeChildren> = {};
    for (const child of activeChildren) {
      if (!byParent[child.parent_id]) byParent[child.parent_id] = [];
      byParent[child.parent_id].push(child);
    }

    const parentIds = Object.keys(byParent);

    // Get parent emails from profiles
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", parentIds);

    if (!profiles) return NextResponse.json({ sent: 0 });

    let sent = 0;

    for (const profile of profiles) {
      const children = byParent[profile.id];
      if (!children?.length) continue;

      // Get each child's sessions from the past week
      const childSummaries = await Promise.all(
        children.map(async (child) => {
          const { data: sessions } = await supabaseAdmin
            .from("sessions")
            .select("xp_earned, words_practiced, duration_seconds")
            .eq("child_id", child.id)
            .gte("created_at", oneWeekAgo);

          const weekSessions = sessions || [];
          const weekStars = weekSessions.reduce((s, x) => s + (x.xp_earned || 0), 0);
          const weekWords = [...new Set(weekSessions.flatMap((s) => s.words_practiced || []))].length;
          const weekMinutes = Math.round(weekSessions.reduce((s, x) => s + (x.duration_seconds || 0), 0) / 60);

          return { child, weekSessions: weekSessions.length, weekStars, weekWords, weekMinutes };
        })
      );

      const childRows = childSummaries.map(({ child, weekSessions, weekStars, weekWords, weekMinutes }) => `
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 12px 16px; font-size: 15px;">${child.avatar || "👦"} ${child.name}</td>
          <td style="padding: 12px 16px; text-align: center; font-weight: 700; color: #F59E0B;">${weekStars} ⭐</td>
          <td style="padding: 12px 16px; text-align: center; font-weight: 700; color: #10B981;">${child.streak} 🔥</td>
          <td style="padding: 12px 16px; text-align: center;">${weekSessions} lessons</td>
          <td style="padding: 12px 16px; text-align: center;">${weekWords} words</td>
          <td style="padding: 12px 16px; text-align: center;">${weekMinutes} min</td>
        </tr>
      `).join("");

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#FFFBF0;font-family:'Nunito',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#047857,#10B981);border-radius:20px;padding:32px;text-align:center;margin-bottom:24px;">
      <h1 style="font-size:28px;font-weight:800;color:white;margin:0 0 8px;">🌟 Weekly Report</h1>
      <p style="font-size:15px;color:rgba(255,255,255,0.85);margin:0;">Here's what ${profile.full_name?.split(" ")[0] || "your child"} learned this week with Ticha</p>
    </div>

    <!-- Table -->
    <div style="background:white;border-radius:16px;padding:0;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#F9FAFB;">
            <th style="padding:12px 16px;text-align:left;font-size:12px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Child</th>
            <th style="padding:12px 16px;text-align:center;font-size:12px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Stars</th>
            <th style="padding:12px 16px;text-align:center;font-size:12px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Streak</th>
            <th style="padding:12px 16px;text-align:center;font-size:12px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Lessons</th>
            <th style="padding:12px 16px;text-align:center;font-size:12px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Words</th>
            <th style="padding:12px 16px;text-align:center;font-size:12px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Time</th>
          </tr>
        </thead>
        <tbody>${childRows}</tbody>
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://ticha.app/dashboard" style="display:inline-block;background:#FF8C00;color:white;text-decoration:none;border-radius:9999px;padding:14px 36px;font-weight:800;font-size:16px;box-shadow:0 4px 0 #CC6A00;">
        📊 View Full Dashboard
      </a>
    </div>

    <!-- Footer -->
    <p style="text-align:center;font-size:12px;color:#9CA3AF;line-height:1.6;">
      Ticha — by Grow Wise Africa · <a href="https://ticha.app" style="color:#10B981;text-decoration:none;">ticha.app</a><br>
      You're receiving this because you have an active child profile.
    </p>
  </div>
</body>
</html>`;

      await resend.emails.send({
        from: "Ticha <reports@ticha.app>",
        to: profile.email,
        subject: `📊 ${profile.full_name?.split(" ")[0] || "Your child"}'s weekly report — Ticha`,
        html,
      });

      sent++;
    }

    return NextResponse.json({ sent, parents: parentIds.length });
  } catch (err) {
    console.error("Weekly summary error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
