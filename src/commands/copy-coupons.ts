import { promises as fs } from "fs";
import { mapToCsvString } from "../core/csv";
import { createStripeClient } from "../core/stripe";
import { sanitizeCoupon } from "./sanitize/coupon";

export async function copyCoupons(
  filePath: string,
  apiKeyOldAccount: string,
  apiKeyNewAccount: string
) {
  const keyMap = new Map();

  // https://stripe.com/docs/api/coupons/list
  for await (const oldCoupon of createStripeClient(
    apiKeyOldAccount
  ).coupons.list({ limit: 100 })) {
    if (
      oldCoupon.redeem_by &&
      oldCoupon.redeem_by <= Math.floor(Date.now() / 1000)
    ) {
      continue;
    }

    const newCoupon = await createStripeClient(apiKeyNewAccount).coupons.create(
      sanitizeCoupon(oldCoupon)
    );

    keyMap.set(oldCoupon.id, newCoupon.id);
  }

  await fs.writeFile(filePath, await mapToCsvString(keyMap));
}
