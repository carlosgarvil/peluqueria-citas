import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { availableSlots, loadTreatments, priceFor } from "@/lib/booking";
import { fmtTime, parseDay } from "@/lib/time";

export const dynamic = "force-dynamic";

/** GET /api/slots?date=YYYY-MM-DD&t=id1,id2 -> huecos libres y desglose de precio */
export async function GET(req: NextRequest) {
  const day = parseDay(req.nextUrl.searchParams.get("date"));
  const ids = (req.nextUrl.searchParams.get("t") ?? "").split(",").filter(Boolean).slice(0, 6);
  if (!day || ids.length === 0) return NextResponse.json({ error: "Parámetros no válidos" }, { status: 400 });

  const treatments = await loadTreatments(ids);
  if (!treatments) return NextResponse.json({ error: "Tratamiento no disponible" }, { status: 404 });

  const session = await getSession();
  // El admin puede consultar el precio con las ofertas de un cliente concreto
  const forUser = req.nextUrl.searchParams.get("u");
  const pricingUserId = session?.role === "ADMIN" && forUser ? forUser : (session?.userId ?? null);
  const durationMin = treatments.reduce((a, t) => a + t.durationMin, 0);
  const [slots, price] = await Promise.all([availableSlots(day, durationMin), priceFor(treatments, day, pricingUserId)]);
  return NextResponse.json({ slots: slots.map(fmtTime), price });
}
