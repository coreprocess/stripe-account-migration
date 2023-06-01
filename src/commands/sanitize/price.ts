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

  for (const tier of data["tiers"] || []) {
    const hasUnitAmountDecimal = tier.unit_amount_decimal !== undefined;
    const hasUnitAmount = tier.unit_amount !== undefined;
    const hasFlatAmountDecimal = tier.flat_amount_decimal !== undefined;
    const hasFlatAmount = tier.flat_amount !== undefined;

    if (!hasUnitAmountDecimal && hasUnitAmount) {
      console.log("Using: unit_amount");
      delete (tier as any)["unit_amount_decimal"];
    } else {
      console.log("Using: unit_amount_decimal");
      delete (tier as any)["unit_amount"];
    }

    if (!hasFlatAmountDecimal && hasFlatAmount) {
      console.log("Using: flat_amount");
      delete (tier as any)["flat_amount_decimal"];
    } else {
      console.log("Using: flat_amount_decimal");
      delete (tier as any)["flat_amount"];
    }

    if (tier.up_to === undefined) {
      (tier as any).up_to = "inf";
    }
  }

  if (data["currency_options"]) {
    delete data["currency_options"][data.currency];
  }

  if (data['custom_unit_amount']) {
    (data['custom_unit_amount'] as any)['enabled'] = true;
  }

  data["product"] = newProductId;

  return data;
}
