import { promises as fs } from "fs";
import { csvStringToMap } from "../core/csv";
import { createStripeClient } from "../core/stripe";
import { calculateRemainingDuration } from "../core/utils";
import Stripe from "stripe";
import { sanitizeCoupon } from "./sanitize/coupon";

export async function applyCustomerCoupons(
  couponsFilePath: string,
  apiKeyOldAccount: string,
  apiKeyNewAccount: string,
) {
  const coupons = await csvStringToMap(
    await fs.readFile(couponsFilePath, "utf8")
  );

  // https://stripe.com/docs/api/customers/list
  const oldStripe = createStripeClient(apiKeyOldAccount);
  const newStripe = createStripeClient(apiKeyNewAccount);

  await oldStripe.customers.list()
    .autoPagingEach(async (customer) => {
      if (customer.discount) {
        let customCoupon = null;
        const oldCouponId = customer.discount.coupon.id;
        const newCouponId = coupons.get(oldCouponId as string);

        if (!newCouponId) throw Error("No matching new coupon_id");

        console.log('Loading coupon...');
        const oldCoupon: Stripe.Coupon = await oldStripe.coupons.retrieve(oldCouponId as string);

        // if coupon.duration === 'repeating', then create a new coupon
        // specially for this customer, with an adjusted duration_in_months
        // to match the remaining duration of the old coupon
        if (oldCoupon.duration === 'repeating' && !!oldCoupon.duration_in_months) {
          const discountStart = new Date(customer.discount.start * 1000);
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

        const setCouponId = customCoupon ? customCoupon.id : newCouponId;
        console.log('Applying coupon to customer:', setCouponId);

        newStripe.customers.update(
          customer.id,
          {
            coupon: setCouponId,
          }
        );
      }
    });
}
