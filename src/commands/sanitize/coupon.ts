import Stripe from "stripe";
import { NonNullableKey, removeNull } from "./common";

const keysToRemove: Array<keyof Stripe.Coupon> = [
  "object",
  "livemode",
  "valid",
  "created",
  "times_redeemed",
];

export function sanitizeCoupon(
  rawData: Stripe.Coupon
): NonNullableKey<Stripe.Coupon> {
  const data = removeNull(rawData);

  keysToRemove.forEach((key) => {
    delete data[key];
  });

  return data;
}
