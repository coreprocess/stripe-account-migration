import { createStripeClient } from "../core/stripe";

export async function setDefaultPaymentMethod(apiKeyNewAccount: string) {
  // https://stripe.com/docs/api/customers/list
  await createStripeClient(apiKeyNewAccount)
    .customers.list()
    .autoPagingEach(async (customer) => {
      if (!customer.invoice_settings.default_payment_method) {
        const paymentMethods = await createStripeClient(
          apiKeyNewAccount
        ).customers.listPaymentMethods(customer.id, { type: "card" });

        const paymentMethod = paymentMethods.data[0];

        if (paymentMethod) {
          await createStripeClient(apiKeyNewAccount).customers.update(
            customer.id,
            {
              invoice_settings: {
                default_payment_method: paymentMethod.id,
              },
            }
          );
        } else {
          console.log(`no default payment method for customer: ${customer.id}`);
        }
      }
    });
}
