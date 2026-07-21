import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createSupabaseAdmin } from "@/lib/supabase";

export const APIRoute = createAPIFileRoute("/api/webhooks/pagseguro")({
  POST: async ({ request }) => {
    const db = createSupabaseAdmin();
    const body = await request.json() as { charges?: { id: string; status: string; reference_id: string }[]; reference_id?: string; id: string };

    const charge = body.charges?.[0];
    const orderId = charge?.reference_id ?? body.reference_id;
    const chargeStatus = charge?.status;

    if (!orderId || !chargeStatus) {
      return new Response("ignored", { status: 200 });
    }

    const statusMap: Record<string, "paid" | "failed" | "pending" | "refunded"> = {
      PAID: "paid",
      DECLINED: "failed",
      CANCELED: "failed",
      IN_ANALYSIS: "pending",
      WAITING: "pending",
      REFUNDED: "refunded",
    };
    const paymentStatus = statusMap[chargeStatus] ?? "pending";

    await db
      .from("orders")
      .update({
        payment_status: paymentStatus,
        payment_id: charge?.id ?? null,
        status: paymentStatus === "paid" ? "confirmed" : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return new Response("ok", { status: 200 });
  },
});
