import { NextResponse } from "next/server";
import { stripe, WEBHOOK_SECRET, CREDIT_PACK_PRICE_ID } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { IS_SELF_HOSTING } from "@/lib/config";
import Stripe from "stripe";

/**
 * Get the current period start/end from subscription.
 * Stripe API structures vary by version - try multiple locations.
 */
function getSubscriptionPeriod(subscription: Stripe.Subscription): {
  start: number;
  end: number;
} {
  // Try subscription-level period (older API versions)
  // @ts-expect-error - may exist on older API versions
  if (subscription.current_period_start && subscription.current_period_end) {
    // @ts-expect-error - may exist on older API versions
    const start = subscription.current_period_start * 1000;
    // @ts-expect-error - may exist on older API versions
    const end = subscription.current_period_end * 1000;
    if (!isNaN(start) && !isNaN(end)) {
      return { start, end };
    }
  }

  // Try item-level period (newer API versions like 2025-11-17)
  const firstItem = subscription.items?.data?.[0];
  if (firstItem?.current_period_start && firstItem?.current_period_end) {
    const start = firstItem.current_period_start * 1000;
    const end = firstItem.current_period_end * 1000;
    if (!isNaN(start) && !isNaN(end)) {
      return { start, end };
    }
  }

  // Fallback to billing cycle anchor
  if (subscription.billing_cycle_anchor) {
    const start = subscription.billing_cycle_anchor * 1000;
    const end = (subscription.billing_cycle_anchor + 30 * 24 * 60 * 60) * 1000;
    if (!isNaN(start) && !isNaN(end)) {
      return { start, end };
    }
  }

  // Final fallback: use current time
  const now = Date.now();
  console.warn(
    "getSubscriptionPeriod: No valid period data found, using current time"
  );
  return {
    start: now,
    end: now + 30 * 24 * 60 * 60 * 1000,
  };
}

/**
 * Handle Stripe webhook events.
 * This endpoint receives events from Stripe and updates the database accordingly.
 */
export async function POST(req: Request) {
  // Stripe is disabled in self-hosting mode
  if (IS_SELF_HOSTING) {
    return NextResponse.json(
      { error: "Billing features are disabled in self-hosting mode" },
      { status: 501 }
    );
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const purchaseType = session.metadata?.type;

        if (!userId) {
          console.error("No userId in checkout session metadata");
          break;
        }

        // Handle credit pack purchase (one-time payment)
        if (session.mode === "payment" && purchaseType === "credit_pack") {
          const paymentIntentId = session.payment_intent as string;

          // Get credit pack config - amount from Convex, price from Stripe (source of truth)
          const [config, price] = await Promise.all([
            convex.query(api.config.getBillingConfig, {}),
            stripe.prices.retrieve(CREDIT_PACK_PRICE_ID),
          ]);

          // Record the credit pack purchase
          await convex.mutation(api.creditPurchases.recordPurchase, {
            userId,
            stripePaymentIntentId: paymentIntentId,
            stripeCheckoutSessionId: session.id,
            creditsAmount: config.creditPackAmount,
            centsPaid: price.unit_amount ?? 0,
          });

          console.log(
            `Credit pack recorded for user ${userId}: ${config.creditPackAmount} credits`
          );
          break;
        }

        // Handle subscription checkout
        if (session.mode === "subscription") {
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId,
            {
              expand: ["items.data.price"],
            }
          );

          const period = getSubscriptionPeriod(subscription);

          // Create subscription record in Convex
          await convex.mutation(api.subscriptions.createSubscription, {
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status: subscription.status,
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
          });

          console.log(`Subscription created for user ${userId}`);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        // In API 2025-11-17, subscription is under parent.subscription_details
        const subscriptionRef =
          invoice.parent?.subscription_details?.subscription;
        const subscriptionId =
          typeof subscriptionRef === "string"
            ? subscriptionRef
            : subscriptionRef?.id;

        if (!subscriptionId) break;

        // Get subscription to update period
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        const period = getSubscriptionPeriod(subscription);

        // Update subscription period - this automatically resets the calculated balance
        // since balance = SUBSCRIPTION_CREDITS - sum(messages where createdAt >= periodStart)
        await convex.mutation(api.subscriptions.updateSubscription, {
          stripeSubscriptionId: subscriptionId,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
        });

        console.log(`Subscription period updated for ${subscriptionId}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const period = getSubscriptionPeriod(subscription);

        // Update subscription status
        await convex.mutation(api.subscriptions.updateSubscription, {
          stripeSubscriptionId: subscriptionId,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
        });

        console.log(
          `Subscription ${subscriptionId} updated to ${subscription.status}`
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const period = getSubscriptionPeriod(subscription);

        // Mark subscription as canceled
        await convex.mutation(api.subscriptions.updateSubscription, {
          stripeSubscriptionId: subscriptionId,
          status: "canceled",
          cancelAtPeriodEnd: false,
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
        });

        console.log(`Subscription ${subscriptionId} canceled`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
