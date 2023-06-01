import { promises as fs } from "fs";
import { csvStringToMap, mapToCsvString } from "../core/csv";
import { createStripeClient } from "../core/stripe";
import { sanitizeSubscription } from "./sanitize/subscription";
import { sanitizeCoupon } from "./sanitize/coupon";
import { calculateRemainingDuration } from "../core/utils";
import Stripe from "stripe";

export async function copySubscriptions(
  pricesFilePath: string,
  subscriptionsFilePath: string,
  automaticTax: boolean,
  couponsFilePath: string,
  apiKeyOldAccount: string,
  apiKeyNewAccount: string
) {
  const prices = await csvStringToMap(
    await fs.readFile(pricesFilePath, "utf8")
  );

  const coupons = await csvStringToMap(
    await fs.readFile(couponsFilePath, "utf8")
  );

  const keyMap = new Map();

  const oldStripe = createStripeClient(apiKeyOldAccount);
  const newStripe = createStripeClient(apiKeyNewAccount);

  // https://stripe.com/docs/api/subscriptions/list
  await oldStripe.subscriptions.list()
    .autoPagingEach(async (oldSubscription) => {

      console.log(`Migrating subscription ${oldSubscription.id}`);

      // skip migrated subscriptions
      if (oldSubscription.metadata.migration_destination_id) {
        console.log(`-> skipped, already migrated as ${oldSubscription.metadata.migration_destination_id}`);
        return;
      }

      // check if customer id exists in destination account
      try {
        await newStripe.customers.retrieve(oldSubscription.customer as string);
      }
      catch (err: any) {
        // propagate error if it's not a customer missing error
        if(err?.code !== 'resource_missing') {
          throw err;
        }
        // skip subscription if customer is missing
        console.log(`-> skipped, customer ${oldSubscription.customer} is missing in destination account`);
        return;
      }

      let setCouponId = '';
      let customCoupon = null;
      if (oldSubscription.discount) {
        console.log('Resolving coupon...');
        const oldCouponId = oldSubscription.discount.coupon.id;
        const newCouponId = coupons.get(oldCouponId as string);
        if (!newCouponId) throw Error("No matching new coupon_id");

        console.log('Loading coupon...');
        const oldCoupon: Stripe.Coupon = await oldStripe.coupons.retrieve(oldCouponId as string);

        // if coupon.duration === 'repeating', then create a new coupon
        // specially for this customer, with an adjusted duration_in_months
        // to match the remaining duration of the old coupon
        if (oldCoupon.duration === 'repeating' && !!oldCoupon.duration_in_months) {
          const discountStart = new Date(oldSubscription.discount.start * 1000);
          const originalDuration = oldCoupon.duration_in_months;
          const remainingDuration = calculateRemainingDuration(discountStart, originalDuration);

          if (remainingDuration < originalDuration) {
            console.log(`Creating custom coupon with duration_in_months: ${remainingDuration} instead of: ${originalDuration}.`);
            const newId = `${oldCouponId}-T-${remainingDuration}`;
            const newRawCoupon = {
              ...oldCoupon,
              id: newId,
              duration_in_months: remainingDuration,
            };
            const newCouponData = sanitizeCoupon(newRawCoupon);
            customCoupon = await newStripe.coupons
              .create(newCouponData)
              .catch((err: any) => {
                // if coupon already exists, then just use it
                // (we've already created a custom version of this duration for this coupon)
                if (err?.code === 'resource_already_exists') {
                  console.log('Custom coupon already exists, using it!');
                  return newStripe.coupons.retrieve(newId);
                } else {
                  console.log('Failed to customize coupon', oldCouponId, 'to duration:', remainingDuration);
                  console.log('UNKNOWN ERROR!', err);
                  console.log('FALLBACK:', newId);
                  return newStripe.coupons.retrieve(newId);
                }
              });
          }
        }

        setCouponId = customCoupon ? customCoupon.id : newCouponId;
        console.log('Including coupon in new subscription:', setCouponId);
      }

      // copy subscription
      const newSubscription = await newStripe
          .subscriptions.create(sanitizeSubscription(oldSubscription, prices, automaticTax, setCouponId))
          .catch((err: any) => {
              if (err?.code !== 'customer_tax_location_invalid') {
                  throw err;
              }
              console.log(`-> WARNING: disable tax automation for customer ${oldSubscription.customer}`);
              return newStripe.subscriptions.create(
                  sanitizeSubscription(oldSubscription, prices, false, setCouponId)
              );
          });

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
