import Stripe from "stripe";
import { NonNullableKey, removeNull } from "./common";

const keysToRemove: Array<keyof Stripe.Price> = [
  "id",
  "unit_amount_decimal",
  "type",
  "livemode",
  "object",
  "created",
];

export function sanitizePrice(
  rawData: Stripe.Price,
  newProductId: string
): any {
  // TODO
  const data = removeNull(rawData);

  keysToRemove.forEach((key) => {
    delete data[key];
  });

  data["product"] = newProductId;

  return data;
}
