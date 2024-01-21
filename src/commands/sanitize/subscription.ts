import Stripe from "stripe";

export function sanitizeSubscription({
  oldSubscription,
  prices,
  automaticTax,
}: {
  oldSubscription: Stripe.Subscription;
  prices: Map<string, string>;
  automaticTax: boolean;
}): Stripe.SubscriptionCreateParams {
  // set trial period
  let trialEnd = oldSubscription.current_period_end;
  if (
    oldSubscription.trial_end &&
    oldSubscription.trial_end >= oldSubscription.current_period_end
  ) {
    trialEnd = oldSubscription.trial_end;
  }

  // update price ids
  const items: {
    price: string;
    quantity: number | undefined;
  }[] = [];
  oldSubscription.items.data.forEach((item) => {
    const priceId = prices.get(item.price.id);

    if (!priceId) throw Error("price_id does not exist");
    items.push({
      price: priceId,
      quantity: item.quantity,
    });
  });

  if (typeof oldSubscription.customer !== "string") {
    throw Error("customer is not of type string");
  }

  return {
    customer: oldSubscription.customer,
    items,
    currency: oldSubscription.currency,
    description: oldSubscription.description
      ? oldSubscription.description
      : undefined,
    metadata: { ...oldSubscription.metadata },
    automatic_tax: { enabled: automaticTax },
    cancel_at: oldSubscription.cancel_at
      ? oldSubscription.cancel_at
      : undefined,
    collection_method: oldSubscription.collection_method,
    days_until_due: oldSubscription.days_until_due
      ? oldSubscription.days_until_due
      : undefined,
    payment_settings: {
      save_default_payment_method: "on_subscription",
    },
    pending_invoice_item_interval:
      oldSubscription.pending_invoice_item_interval,
    trial_end: trialEnd,
  };
}
