import { promises as fs } from "fs";
import { csvStringToMap, mapToCsvString } from "../core/csv";
import { createStripeClient } from "../core/stripe";
import { sanitizeSubscription } from "./sanitize/subscription";

export async function copySubscriptions(
  pricesFilePath: string,
  pricesInlineFilePath: string,
  productsInlineFilePath: string,
  subscriptionsFilePath: string,
  automaticTax: boolean,
  apiKeyOldAccount: string,
  apiKeyNewAccount: string
) {
  const prices = await csvStringToMap(
    await fs.readFile(pricesFilePath, "utf8")
  );

  const keyMap = new Map();

  // https://stripe.com/docs/api/subscriptions/list
  await createStripeClient(apiKeyOldAccount)
    .subscriptions.list()
    .autoPagingEach(async (oldSubscription) => {
      console.log(`Migrating subscription ${oldSubscription.id}`);

      // skip migrated subscriptions
      if (oldSubscription.metadata.migration_destination_id) {
        console.log(
          `-> skipped, already migrated as ${oldSubscription.metadata.migration_destination_id}`
        );
        return;
      }

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

      const productMap = new Map();
      const priceMap = new Map();
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

          console.log("Migrated price");
          console.log({ product, price });
        } catch (err) {
          console.log(err);
          console.log(
            `Failed to migrate price ${subscriptionItem.price.id} for subscription ${oldSubscription.id}`
          );
          isCausedError = true;
        }
      }

      fs.writeFile(pricesInlineFilePath, await mapToCsvString(priceMap));
      fs.writeFile(productsInlineFilePath, await mapToCsvString(productMap));

      if (isCausedError) {
        try {
          console.log("Rolling back...");
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

      // copy subscription
      let newSubscription;
      try {
        newSubscription = await createStripeClient(
          apiKeyNewAccount
        ).subscriptions.create(
          sanitizeSubscription({
            oldSubscription,
            prices: new Map([...prices, ...priceMap]),
            automaticTax,
          })
        );
      } catch (err: any) {
        if (err?.code !== "customer_tax_location_invalid") {
          throw err;
        }
        console.log(
          `-> WARNING: disable tax automation for customer ${oldSubscription.customer}`
        );

        newSubscription = await createStripeClient(
          apiKeyNewAccount
        ).subscriptions.create(
          sanitizeSubscription({
            oldSubscription,
            prices,
            automaticTax: false,
          })
        );
      }

      // update mapping (we write it multiple times to ensure we don't lose data when an error occurs)
      keyMap.set(oldSubscription.id, newSubscription.id);
      await fs.writeFile(subscriptionsFilePath, await mapToCsvString(keyMap));
      console.log(`-> migrated to ${newSubscription.id}`);

      // mark subscription as migrated
      await createStripeClient(apiKeyOldAccount).subscriptions.update(
        oldSubscription.id,
        { metadata: { migration_destination_id: newSubscription.id } }
      );

      // cancel subscription in old account
      await createStripeClient(apiKeyOldAccount).subscriptions.update(
        oldSubscription.id,
        { cancel_at_period_end: true }
      );
      console.log(`-> scheduled for cancellation in old account`);
    });
}
