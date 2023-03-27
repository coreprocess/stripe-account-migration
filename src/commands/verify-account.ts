import { createStripeClient } from "../core/stripe";

export async function verifyAccount(apiKey: string) {
  const data = await createStripeClient(apiKey).accounts.retrieve({});

  console.log(data);
}
