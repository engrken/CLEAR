import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dispatchDigitalReceipts } from "@/lib/digital-receipts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "") || "";
  if (!secret || !token || Buffer.byteLength(secret) !== Buffer.byteLength(token) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try { return NextResponse.json(await dispatchDigitalReceipts({ limit: 30 })); }
  catch { return NextResponse.json({ error: "Receipt dispatch unavailable" }, { status: 503 }); }
}
