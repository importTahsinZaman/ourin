import { NextResponse } from "next/server";
import { stripe, WEBHOOK_SECRET, CREDIT_PACK_PRICE_ID } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { IS_SELF_HOSTING } from "@/lib/config";
import { trackServerEvent } from "@/lib/posthog-server";
import Stripe from "stripe";

/**
 * get the current period start/end from subscription.
 * stripe aPI structures vary by version - try multiple locations.
 */
function getSubscriptionPeriod(subscription: Stripe.Subscription): {
  start: number;
  end: number;
} {
  // try subscription-level period (older aPI versions)
  // @ts-expect-error - may exist on older aPI versions
  if (subscription.current_period_start && subscription.current_period_end) {
    // @ts-expect-error - may exist on older aPI versions
    const start = subscription.current_period_start * 1000;
    // @ts-expect-error - may exist on older aPI versions
    const end = subscription.current_period_end * 1000;
    if (!isNaN(start) && !isNaN(end)) {
      return { start, end };
    }
  }

  // try item-level period (newer aPI versions like 2025-11-17)
  const firstItem = subscription.items?.data?.[0];
  if (firstItem?.current_period_start && firstItem?.current_period_end) {
    const start = firstItem.current_period_start * 1000;
    const end = firstItem.current_period_end * 1000;
    if (!isNaN(start) && !isNaN(end)) {
      return { start, end };
    }
  }

  // fallback to billing cycle anchor
  if (subscription.billing_cycle_anchor) {
    const start = subscription.billing_cycle_anchor * 1000;
    const end = (subscription.billing_cycle_anchor + 30 * 24 * 60 * 60) * 1000;
    if (!isNaN(start) && !isNaN(end)) {
      return { start, end };
    }
  }

  // final fallback: use current time
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
 * handle stripe webhook events.
 * this endpoint receives events from stripe and updates the database accordingly.
 */
export async function POST(req: Request) {
  // stripe is disabled in self-hosting mode
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

        // handle credit pack purchase (one-time payment)
        if (session.mode === "payment" && purchaseType === "credit_pack") {
          const paymentIntentId = session.payment_intent as string;

          // get credit pack config - amount from convex, price from stripe (source of truth)
          const [config, price] = await Promise.all([
            convex.query(api.config.getBillingConfig, {}),
            stripe.prices.retrieve(CREDIT_PACK_PRICE_ID),
          ]);

          // record the credit pack purchase
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

          await trackServerEvent(userId, "subscription_event", {
            tier: "subscriber",
            action: "credits_purchased",
            creditsAmount: config.creditPackAmount,
            priceCents: price.unit_amount ?? 0,
          });
          break;
        }

        // handle subscription checkout
        if (session.mode === "subscription") {
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          // get subscription details
          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId,
            {
              expand: ["items.data.price"],
            }
          );

          const period = getSubscriptionPeriod(subscription);

          // create subscription record in convex
          await convex.mutation(api.subscriptions.createSubscription, {
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status: subscription.status,
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
          });

          console.log(`Subscription created for user ${userId}`);

          await trackServerEvent(userId, "subscription_event", {
            tier: "subscriber",
            action: "subscription_created",
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        // in aPI 2025-11-17, subscription is under parent.subscription_details
        const subscriptionRef =
          invoice.parent?.subscription_details?.subscription;
        const subscriptionId =
          typeof subscriptionRef === "string"
            ? subscriptionRef
            : subscriptionRef?.id;

        if (!subscriptionId) break;

        // get subscription to update period
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        const period = getSubscriptionPeriod(subscription);

        // update subscription period - this automatically resets the calculated balance
        // since balance = sUBSCRIPTION_cREDITS - sum(messages where createdAt >= periodStart)
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

        // update subscription status
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

        // mark subscription as canceled
        await convex.mutation(api.subscriptions.updateSubscription, {
          stripeSubscriptionId: subscriptionId,
          status: "canceled",
          cancelAtPeriodEnd: false,
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
        });

        console.log(`Subscription ${subscriptionId} canceled`);

        // try to get userId from subscription metadata
        const canceledUserId = subscription.metadata?.userId;
        if (canceledUserId) {
          await trackServerEvent(canceledUserId, "subscription_event", {
            tier: "subscriber",
            action: "subscription_cancelled",
          });
        }
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
