import { NextResponse } from "next/server";
import { stripe, SUBSCRIPTION_PRICE_ID } from "@/lib/stripe";
import {
  verifyChatToken,
  extractChatToken,
  type TokenVerificationError,
} from "@/lib/verifyChatToken";
import { IS_SELF_HOSTING } from "@/lib/config";

/**
 * create a stripe checkout session for subscribing to the $10/month plan.
 */
export async function POST(req: Request) {
  // stripe is disabled in self-hosting mode
  if (IS_SELF_HOSTING) {
    return NextResponse.json(
      { error: "Billing features are disabled in self-hosting mode" },
      { status: 501 }
    );
  }

  try {
    const body = await req.json();

    // extract token from authorization header (preferred) or body (fallback)
    const chatToken =
      extractChatToken(req) || (body.chatToken as string | undefined);

    if (!chatToken) {
      return NextResponse.json(
        { error: "Unauthorized - no token provided" },
        { status: 401 }
      );
    }

    const result = await verifyChatToken(chatToken);
    if (!result.valid || result.userId === "anonymous") {
      const errorMessage =
        result.error === "expired"
          ? "Unauthorized - token expired"
          : result.error === "invalid_signature"
            ? "Unauthorized - invalid token signature"
            : result.error === "malformed_token"
              ? "Unauthorized - malformed token"
              : "Unauthorized - please sign in to subscribe";

      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }

    const userId = result.userId;

    // create stripe checkout session for subscription only
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: SUBSCRIPTION_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/?settings=billing&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/?settings=billing&canceled=true`,
      metadata: {
        userId: userId ?? "",
      },
      subscription_data: {
        metadata: {
          userId: userId ?? "",
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
