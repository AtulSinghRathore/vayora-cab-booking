import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getDatabase, verifyAdmin } from "../../../../lib/platform";

export async function GET(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ source: "property-file", properties: "" });
  await ensureSchema(db);
  const row = await db.prepare("SELECT value FROM settings WHERE key='fare.properties'").first<{ value: string }>();
  return NextResponse.json({ source: row ? "admin-override" : "property-file", properties: row?.value || "" });
}

export async function PUT(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDatabase();
  if (!db) return NextResponse.json({ error: "Connect Cloudflare D1 before saving fares." }, { status: 503 });
  const { properties } = await request.json();
  if (!properties || typeof properties !== "string" || properties.length > 12000) return NextResponse.json({ error: "Invalid fare configuration." }, { status: 400 });
  await ensureSchema(db);
  await db.prepare("INSERT INTO settings(key,value,updated_at) VALUES('fare.properties',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
    .bind(properties, new Date().toISOString()).run();
  return NextResponse.json({ success: true, message: "Fare configuration saved and active." });
}
