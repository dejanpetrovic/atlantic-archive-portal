import { NextRequest, NextResponse } from "next/server";
import { apiAuth } from "@/lib/api";
import { normalizePhone, searchRecordings } from "@/lib/recordings";
import { logAccess } from "@/lib/log";

export async function GET(req: NextRequest) {
  const auth = await apiAuth("acid-call-recordings", "search");
  if (!auth.ok) return auth.res;

  const params = req.nextUrl.searchParams;
  const phone = (params.get("phone") ?? "").slice(0, 32);
  const direction = params.get("direction");
  const dateFrom = params.get("from");
  const dateTo = params.get("to");
  const cursor = params.get("cursor");

  const isDate = (s: string | null) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!isDate(dateFrom) || !isDate(dateTo)) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }

  const digits = normalizePhone(phone);
  if (phone && digits.length > 0 && digits.length < 7) {
    return NextResponse.json({
      rows: [],
      total: 0,
      nextCursor: null,
      note: "enter at least 7 digits",
    });
  }

  try {
    const result = await searchRecordings({
      phone,
      direction,
      dateFrom,
      dateTo,
      cursor,
    });

    if (!cursor && (digits.length >= 7 || direction || dateFrom || dateTo)) {
      await logAccess(
        auth.user.id,
        "search",
        "acid-call-recordings",
        undefined,
        JSON.stringify({
          phone: digits || undefined,
          direction: direction || undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
        }),
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("recordings search failed", err);
    return NextResponse.json({ error: "search failed" }, { status: 500 });
  }
}
