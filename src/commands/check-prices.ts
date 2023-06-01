import { promises as fs } from "fs";
import { csvStringToMap, mapToCsvString } from "../core/csv";
import { createStripeClient } from "../core/stripe";
import { sanitizePrice } from "./sanitize/price";

export async function checkPrices(
  productsFilePath: string,
  pricesFilePath: string,
  apiKeyOldAccount: string,
  apiKeyNewAccount: string
) {
  const products = await csvStringToMap(
    await fs.readFile(productsFilePath, "utf8")
  );

  const keyMap = new Map();

  // https://stripe.com/docs/api/prices/list
  await createStripeClient(apiKeyOldAccount)
    .prices.list({
      limit: 100,
      expand: ["data.currency_options", "data.tiers"],
    })
    .autoPagingEach(async (oldPrice) => {
      console.log('Processing price: ', oldPrice.id);

      // check all tiers have amount:
      if (oldPrice.tiers) {
        oldPrice.tiers.forEach((tier) => {
          if (tier.unit_amount === undefined || tier.unit_amount === null) {
            console.log('----------------');
            console.log(tier);
            console.log("tier.unit_amount is missing ########################################################################");
          }
        });
      }

      console.log('SANITIZING..................');
      const x = sanitizePrice(oldPrice, "productIdPlaceholder");
      console.log('Sanitized:', x);


    });

  // Display output in console, just in case writing to file fails
  const output = await mapToCsvString(keyMap);
  console.log('Writing output to:', pricesFilePath);
  console.log('---------------------------');
  console.log(output);
  console.log('---------------------------');
  await fs.writeFile(pricesFilePath, output);
}

