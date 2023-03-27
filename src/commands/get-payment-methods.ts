import { promises as fs } from "fs";
import { createStripeClient } from "../core/stripe";

const brands = [
  "amex",
  "diners",
  "discover",
  "jcb",
  "mastercard",
  "unionpay",
  "visa",
  "unknown",
  "none",
];

export async function getPaymentMethods(
  paymentMethodsFilePath: string,
  apiKey: string
) {
  const keyMap = new Map<
    string,
    {
      [key: typeof brands[number]]: string;
    }
  >();

  // https://stripe.com/docs/api/subscriptions/list
  await createStripeClient(apiKey)
    .subscriptions.list()
    .autoPagingEach(async (subscription) => {
      if (typeof subscription.customer !== "string") {
        throw Error("type of customer is not a string");
      }

      const paymentMethods = await createStripeClient(
        apiKey
      ).customers.listPaymentMethods(subscription.customer, { type: "card" });

      const availableBrands: {
        [key: typeof brands[number]]: string;
      } = brands.reduce((a, v) => ({ ...a, [v]: "" }), {});

      paymentMethods.data.forEach((method) => {
        if (method.card?.brand) {
          availableBrands[method.card.brand] = "x";
        }
      });

      if (paymentMethods.data.length === 0) {
        availableBrands["none"] = "x";
      }

      keyMap.set(subscription.customer, availableBrands);
    });

  await fs.writeFile(paymentMethodsFilePath, keyMapToCSVString(keyMap));
}

function keyMapToCSVString(
  keyMap: Map<
    string,
    {
      [key: typeof brands[number]]: string;
    }
  >
) {
  let csv = `customer,${Object.entries(brands).map(
    ([_, value]) => `${value}`
  )}\n`;

  keyMap.forEach((brands, key) => {
    csv += `${key}${Object.entries(brands).map(([_, value]) => `${value}`)}\n`;
  });

  return csv;
}
