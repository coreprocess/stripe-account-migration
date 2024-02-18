import { promises as fs } from "fs";
import { csvStringToMap, mapToCsvString } from "../core/csv";
import { createStripeClient } from "../core/stripe";
import { sanitizeSubscription } from "./sanitize/subscription";

export async function copySubscriptions(
  pricesFilePath: string,
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
    .autoPagingEach(async function (oldSubscription) {
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

      // copy subscription
      const newSubscription = await createStripeClient(apiKeyNewAccount)
        .subscriptions.create(
          sanitizeSubscription({ oldSubscription, prices, automaticTax })
        )
        .catch((err: any) => {
          if (err?.code !== "customer_tax_location_invalid") {
            throw err;
          }
          console.log(
            `-> WARNING: disable tax automation for customer ${oldSubscription.customer}`
          );
          return createStripeClient(apiKeyNewAccount).subscriptions.create(
            sanitizeSubscription({
              oldSubscription,
              prices,
              automaticTax: false,
            })
          );
        });

      // update mapping (we write it multiple times to ensure we don't lose data when an error occurs)
      keyMap.set(oldSubscription.id, newSubscription.id);
      await fs.writeFile(subscriptionsFilePath, await mapToCsvString(keyMap));
      console.log(`-> migrated to ${newSubscription.id}`);

      // mark subscription as migrated
      await createStripeClient(apiKeyOldAccount).subscriptions.update(
        oldSubscription.id,
        {
          metadata: {
            // Prevents loosing of old metadata
            ...oldSubscription.metadata,
            migration_destination_id: newSubscription.id,
          },
        }
      );

      // cancel subscription in old account
      await createStripeClient(apiKeyOldAccount).subscriptions.update(
        oldSubscription.id,
        { cancel_at_period_end: true }
        // { pause_collection: { behavior: "keep_as_draft" } }
      );
      console.log(`-> scheduled for cancellation in old account`);
    });
}
