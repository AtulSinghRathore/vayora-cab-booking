import { NextRequest, NextResponse } from "next/server";
import { issueAdminToken } from "../../../../lib/platform";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  const adminEmail = process.env.ADMIN_EMAIL || "natul0636@gmail.com";
  if (!process.env.ADMIN_PASSWORD || email !== adminEmail || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
  }
  return NextResponse.json({ token: await issueAdminToken(adminEmail) });
}
