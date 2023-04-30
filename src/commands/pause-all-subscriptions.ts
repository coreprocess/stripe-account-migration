import { createStripeClient } from "../core/stripe";

export async function pauseAllSubscriptions(apiKeyOldAccount: string) {
  // https://stripe.com/docs/api/subscriptions/list
  await createStripeClient(apiKeyOldAccount)
    .subscriptions.list()
    .autoPagingEach(async (oldSubscription) => {
      await createStripeClient(apiKeyOldAccount).subscriptions.update(
        oldSubscription.id,
        { pause_collection: { behavior: "void" } }
      );
    });
}
