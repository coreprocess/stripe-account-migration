import { createStripeClient } from "../core/stripe";

export async function hasApiSubscriptionWriteAccess(
  subscriptionId: string,
  apiKey: string
) {
  await createStripeClient(apiKey).subscriptions.update(subscriptionId, {
    metadata: { access: "yes" },
  });
}
