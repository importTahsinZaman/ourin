import { NextResponse } from "next/server";
import { stripe, CREDIT_PACK_PRICE_ID } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { IS_SELF_HOSTING } from "@/lib/config";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Get billing configuration for display in UI.
 * Fetches credit amounts from Convex and prices from Stripe (source of truth).
 * In self-hosting mode, returns minimal config indicating billing is disabled.
 */
export async function GET() {
  // In self-hosting mode, return minimal config
  if (IS_SELF_HOSTING) {
    return NextResponse.json({
      isSelfHosting: true,
      subscriptionCredits: null,
      creditPackAmount: null,
      creditPackPriceCents: null,
    });
  }

  try {
    // Fetch in parallel
    const [convexConfig, creditPackPrice] = await Promise.all([
      convex.query(api.config.getBillingConfig, {}),
      stripe.prices.retrieve(CREDIT_PACK_PRICE_ID),
    ]);

    return NextResponse.json({
      isSelfHosting: false,
      subscriptionCredits: convexConfig.subscriptionCredits,
      creditPackAmount: convexConfig.creditPackAmount,
      creditPackPriceCents: creditPackPrice.unit_amount ?? 2000,
    });
  } catch (error) {
    console.error("Failed to fetch billing config:", error);
    // Return defaults on error so UI doesn't break
    return NextResponse.json({
      isSelfHosting: false,
      subscriptionCredits: 10000,
      creditPackAmount: 20000,
      creditPackPriceCents: 2000,
    });
  }
}
