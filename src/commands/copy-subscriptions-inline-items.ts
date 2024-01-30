import { promises as fs } from "fs";
import { mapToCsvString } from "../core/csv";
import { createStripeClient } from "../core/stripe";

export async function copySubscriptionsInlineItems(
  pricesInlineFilePath: string,
  apiKeyOldAccount: string,
  apiKeyNewAccount: string
) {
  const productMap = new Map();
  const priceMap = new Map();

  // https://stripe.com/docs/api/subscriptions/list
  await createStripeClient(apiKeyOldAccount)
    .subscriptions.list()
    .autoPagingEach(async (oldSubscription) => {
      console.log(
        `Migrating subscription items for subscription ${oldSubscription.id}`
      );

      // check if customer id exists in destination account
      try {
        await createStripeClient(apiKeyNewAccount).customers.retrieve(
          oldSubscription.customer as string
        );
      } catch (err: any) {
        // propagate error if it's not a customer missing error
        if (err?.code !== "resource_missing") {
          throw err;
        }
        // skip subscription if customer is missing
        console.log(
          `-> skipped, customer ${oldSubscription.customer} is missing in destination account`
        );
        return;
      }

      let oldSubscriptionExpanded;
      try {
        oldSubscriptionExpanded = await createStripeClient(
          apiKeyOldAccount
        ).subscriptions.retrieve(oldSubscription.id, {
          expand: [
            "plan",
            "items.data.plan.product",
            "items.data.price.product",
            "items.data.tax_rates",
          ],
        });
      } catch (err: any) {
        console.log(
          `-> WARNING: could not expand subscription ${oldSubscription.id} in old account. Aborting.`
        );
        return;
      }

      let isCausedError = false;

      for (const subscriptionItem of oldSubscriptionExpanded.items.data) {
        if (typeof subscriptionItem.price.product === "string") {
          console.log(
            `Failed to migrate inline price. Is it standalone? Subscription ${oldSubscription.id}, price ${subscriptionItem.price.id}`
          );
          continue;
        }
        if (subscriptionItem.price.product.deleted) {
          console.log(
            `Skipping deleted product. Subscription ${oldSubscription.id}, product ${subscriptionItem.price.product.id}`
          );
          continue;
        }
        let product, price;

        try {
          const newStripe = createStripeClient(apiKeyNewAccount);
          product = await newStripe.products.create({
            name: subscriptionItem.price.product.name,
            description:
              subscriptionItem.price.product.description ?? undefined,
          });

          productMap.set(subscriptionItem.price.product.id, product.id);

          if (!subscriptionItem.price.recurring) {
            throw new Error("Price of subscription is not recurring");
          }

          price = await newStripe.prices.create({
            product: product.id,
            unit_amount: subscriptionItem.price.unit_amount ?? undefined,
            currency: subscriptionItem.price.currency,
            recurring: {
              interval: subscriptionItem.price.recurring.interval,
              interval_count: subscriptionItem.price.recurring.interval_count,
              aggregate_usage:
                subscriptionItem.price.recurring.aggregate_usage ?? undefined,
              usage_type:
                subscriptionItem.price.recurring.usage_type ?? undefined,
            },
            // tax_behavior: subscriptionItem.price.tax_behavior ?? undefined,
          });

          priceMap.set(subscriptionItem.plan.id, price.id);

          console.log(
            `Migrated price ${subscriptionItem.price.id} -> ${price.id} for subscription ${oldSubscription.id}`
          );
        } catch (err) {
          console.log(err);
          console.log(
            `Failed to migrate price ${subscriptionItem.price.id} for subscription ${oldSubscription.id}`
          );
          isCausedError = true;
        }
      }

      await fs.writeFile(pricesInlineFilePath, await mapToCsvString(priceMap));

      if (isCausedError) {
        try {
          console.log(`Rolling back subscription ${oldSubscription.id}...`);
          for (const productId of productMap.values()) {
            await createStripeClient(apiKeyNewAccount).products.del(productId);
          }
          for (const priceId of priceMap.values()) {
            await createStripeClient(apiKeyNewAccount).prices.update(priceId, {
              active: false,
            });
          }
          console.log("Rollback successful");
        } catch (err) {
          console.log("Failed to rollback");
          console.log(err);
          return;
        }
      }

      console.log(
        `-> migrated prices & products for subscription: ${oldSubscription.id}`
      );
    });
}
