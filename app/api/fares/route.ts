import { NextResponse } from "next/server";
import { ensureSchema, getDatabase } from "../../../lib/platform";

export async function GET() {
  const db = getDatabase();
  if (db) {
    await ensureSchema(db);
    const row = await db.prepare("SELECT value FROM settings WHERE key='fare.properties'").first<{ value: string }>();
    if (row?.value) return new Response(row.value, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
  return NextResponse.json({ fallback: "/config/fare.properties" }, { status: 404 });
}
