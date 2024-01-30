import { promises as fs } from "fs";
import { mapToCsvString } from "../core/csv";
import { createStripeClient } from "../core/stripe";

export async function copyInvoices(
  customerId: string,
  invoicesFilePath: string,
  apiKeyOldAccount: string,
  apiKeyNewAccount: string
) {
  const invoiceMap = new Map();

  // https://stripe.com/docs/api/invoices/list
  await createStripeClient(apiKeyOldAccount)
    .invoices.list({
      customer: customerId,
      expand: ["data.discounts", "data.lines.data.price"],
    })
    .autoPagingEach(async (oldInvoice) => {
      console.log(`Migrating invoice ${oldInvoice.id}`);

      // skip migrated invoices
      if (oldInvoice.metadata?.migration_destination_id) {
        console.log(
          `-> skipped, already migrated as ${oldInvoice.metadata.migration_destination_id}`
        );
        return;
      }

      // check if customer id exists in destination account
      let customer;
      try {
        customer = await createStripeClient(
          apiKeyNewAccount
        ).customers.retrieve(oldInvoice.customer as string);
      } catch (err: any) {
        // propagate error if it's not a customer missing error
        if (err?.code !== "resource_missing") {
          throw err;
        }
        // skip subscription if customer is missing
        console.log(
          `-> skipped, customer ${oldInvoice.customer} is missing in destination account`
        );
        return;
      }

      let newInvoice;
      try {
        const defaultSource =
          typeof oldInvoice.default_source === "string"
            ? oldInvoice.default_source
            : oldInvoice.default_source?.id;

        const defaultPaymentMethod =
          typeof oldInvoice.default_payment_method === "string"
            ? oldInvoice.default_payment_method
            : oldInvoice.default_payment_method?.id;

        const defaultTaxRates =
          typeof oldInvoice.default_tax_rates[0] === "string"
            ? (oldInvoice.default_tax_rates as unknown as string[])
            : oldInvoice.default_tax_rates.map((taxRate) => taxRate.id);

        const newStripe = createStripeClient(apiKeyNewAccount);

        newInvoice = await newStripe.invoices.create({
          auto_advance: false,
          application_fee_amount:
            oldInvoice.application_fee_amount ?? undefined,
          collection_method: oldInvoice.collection_method,
          custom_fields: oldInvoice.custom_fields ?? undefined,
          default_payment_method: defaultPaymentMethod ?? undefined,
          default_source: defaultSource ?? undefined,
          default_tax_rates: defaultTaxRates ?? undefined,
          description: oldInvoice.description ?? undefined,
          footer: oldInvoice.footer ?? undefined,

          customer: customer.id ?? undefined,
          pending_invoice_items_behavior: "exclude",
          metadata: {
            ...(oldInvoice.metadata || {}),
            migration_source_id: oldInvoice.id,
          },
        });

        const items = oldInvoice.lines.data;

        for (const line of items) {
          await newStripe.invoiceItems.create({
            invoice: newInvoice.id,
            customer: customer.id,
            unit_amount_decimal: line.price?.unit_amount_decimal ?? undefined,
            currency: line.price?.currency,
            description: line.description ?? undefined,
            quantity: line.quantity ?? undefined,
          });
        }

        await newStripe.invoices.finalizeInvoice(newInvoice.id, {
          auto_advance: false,
        });

        await newStripe.invoices.pay(newInvoice.id, {
          paid_out_of_band: true,
        });

        invoiceMap.set(oldInvoice.id, newInvoice.id);
      } catch (err) {
        console.log(err);
        console.log(
          `Failed to migrate invoice ${oldInvoice.id} for user ${customer.id}`
        );
      }

      try {
        if (!newInvoice) {
          throw new Error("New invoice is not created");
        }

        await createStripeClient(apiKeyOldAccount).invoices.update(
          oldInvoice.id,
          {
            metadata: {
              ...(oldInvoice.metadata || {}),
              migration_destination_id: newInvoice.id,
            },
          }
        );
      } catch (err) {
        console.log(err);
        console.log(
          `Failed to update invoice ${oldInvoice.id} for user ${customer.id}`
        );
        return;
      }

      await fs.writeFile(invoicesFilePath, await mapToCsvString(invoiceMap));
    });

  console.log(`-> migrated invoices ${invoiceMap.size}`);
}
