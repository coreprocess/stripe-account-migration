import { createStripeClient } from "../core/stripe";

export async function cancelAllSubscriptions(apiKeyOldAccount: string) {
  // https://stripe.com/docs/api/subscriptions/list
  await createStripeClient(apiKeyOldAccount)
    .subscriptions.list()
    .autoPagingEach(async (oldSubscription) => {
      await createStripeClient(apiKeyOldAccount).subscriptions.update(
        oldSubscription.id,
        { cancel_at_period_end: true }
      );
    });
}
