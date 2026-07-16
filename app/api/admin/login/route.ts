import { NextRequest, NextResponse } from "next/server";
import { getRuntimeString, issueAdminToken } from "../../../../lib/platform";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  const adminEmail = getRuntimeString("ADMIN_EMAIL", "anupkr9265@gmail.com");
  const adminPassword = getRuntimeString("ADMIN_PASSWORD");
  const sessionSecret = getRuntimeString("ADMIN_SESSION_SECRET");
  if (!adminPassword || !sessionSecret) {
    return NextResponse.json({ error: "Admin login is not configured yet. Add ADMIN_PASSWORD and ADMIN_SESSION_SECRET as encrypted Cloudflare secrets." }, { status: 503 });
  }
  if (email !== adminEmail || password !== adminPassword) {
    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }
  return NextResponse.json({ token: await issueAdminToken(adminEmail) });
}
