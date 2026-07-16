import { NextRequest, NextResponse } from "next/server";
import { getEmailConfiguration, sendTestEmail } from "../../../../lib/email";
import { getDatabase, verifyAdmin } from "../../../../lib/platform";

export async function GET(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    email: getEmailConfiguration(),
    databaseConfigured: Boolean(getDatabase()),
  });
}

export async function POST(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await sendTestEmail();
  return result.ok
    ? NextResponse.json({ success: true, message: "Test email sent. Check the admin inbox and spam folder." })
    : NextResponse.json({ error: result.error }, { status: 502 });
}
