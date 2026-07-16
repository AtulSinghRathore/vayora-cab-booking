import { NextRequest, NextResponse } from "next/server";
import { issueAdminToken } from "../../../../lib/platform";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  const adminEmail = process.env.ADMIN_EMAIL || "natul0636@gmail.com";
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
    return NextResponse.json({ error: "Admin login is not configured yet. Add ADMIN_PASSWORD and ADMIN_SESSION_SECRET as encrypted Cloudflare secrets." }, { status: 503 });
  }
  if (email !== adminEmail || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }
  return NextResponse.json({ token: await issueAdminToken(adminEmail) });
}
