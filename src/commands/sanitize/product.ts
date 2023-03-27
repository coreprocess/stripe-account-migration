import Stripe from "stripe";
import { removeNull } from "./common";

const keysToRemove: Array<keyof Stripe.Product> = [
  "id",
  "livemode",
  "object",
  "default_price",
  "created",
  "updated",
];

export function sanitizeProduct(rawData: Stripe.Product): any {
  // TODO
  const data = removeNull(rawData);

  keysToRemove.forEach((key) => {
    delete data[key];
  });

  return data;
}
