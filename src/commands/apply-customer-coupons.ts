import { promises as fs } from "fs";
import { csvStringToMap } from "../core/csv";
import { createStripeClient } from "../core/stripe";

export async function applyCustomerCoupons(
  couponsFilePath: string,
  apiKeyOldAccount: string,
  apiKeyNewAccount: string,
) {
  const coupons = await csvStringToMap(
    await fs.readFile(couponsFilePath, "utf8")
  );

  // https://stripe.com/docs/api/customers/list
  await createStripeClient(apiKeyOldAccount)
    .customers.list()
    .autoPagingEach(async (customer) => {
      if (customer.discount) {
        const oldCouponId = customer.discount.coupon.id;
        const newCouponId = coupons.get(oldCouponId as string);

        if (!newCouponId) throw Error("No matching new coupon_id");

        await createStripeClient(apiKeyNewAccount).customers.update(
          customer.id,
          {
            coupon: newCouponId,
          }
        );
      }
    });
}
