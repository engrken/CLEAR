// CI-only HTTP harness: this fixture is outside app/ and copied into app/
// ONLY by the disposable GitHub Actions job. Never deploy this as a real route.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { recordPayment } from "@/app/department/[department]/(protected)/collections/actions";
import { verifyOnlineRemittance } from "@/app/department/[department]/(protected)/remittances/actions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (
    process.env.CLEAR_CI_FINANCE_TEST_ENABLED !== "1" ||
    !process.env.CLEAR_CI_FINANCE_TEST_TOKEN ||
    request.headers.get("x-clear-ci-token") !== process.env.CLEAR_CI_FINANCE_TEST_TOKEN
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const body = await request.json();
    let result: unknown;
    if (body.operation === "cashier") {
      result = await recordPayment("ci-financial", body.data);
    } else if (body.operation === "remittance") {
      result = await verifyOnlineRemittance("ci-financial", body.data);
    } else {
      return NextResponse.json({ error: "Unknown operation" }, { status: 400 });
    }
    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    return NextResponse.json({
      success: false, error: error instanceof Error ? error.message : "Request failed",
    }, { status: 409 });
  }
}
