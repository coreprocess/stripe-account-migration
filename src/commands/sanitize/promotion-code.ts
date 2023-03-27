import Stripe from "stripe";
import { removeNull } from "./common";

const keysToRemove: Array<keyof Stripe.PromotionCode> = ["id", "livemode", "object", "created", "times_redeemed"];

export function sanitizePromotionCode(
  rawData: Stripe.PromotionCode,
  newCouponId: string
): any {
  // TODO
  const data = removeNull(rawData);

  keysToRemove.forEach((key) => {
    delete data[key];
  });

  data["coupon"] = newCouponId as any;

  return data;
}
