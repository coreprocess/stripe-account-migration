import "dotenv/config";
import { cancelAllSubscriptions } from "./commands/cancel-all-subscriptions";
import { copyCoupons } from "./commands/copy-coupons";
import { copyPrices } from "./commands/copy-prices";
import { copyProducts } from "./commands/copy-products";
import { copyPromotionCodes } from "./commands/copy-promotion-codes";
import { copySubscriptions } from "./commands/copy-subscriptions";
import { getPaymentMethods } from "./commands/get-payment-methods";
import { hasApiSubscriptionWriteAccess } from "./commands/has-api-subscription-write-access";
import { pauseAllSubscriptions } from "./commands/pause-all-subscriptions";
import { setDefaultPaymentMethod } from "./commands/set-default-payment-method";
import { verifyAccount } from "./commands/verify-account";
import { applyCustomerCoupons } from "./commands/apply-customer-coupons";
import { copySubscriptionsInlineItems } from "./commands/copy-subscriptions-inline-items";
import { copyInvoices } from "./commands/copy-invoices";

async function main(action: string, args: string[]) {
  if (action === "verify-account") {
    await verifyAccount(args[0]);
  } else if (action === "copy-products") {
    await copyProducts(args[0], args[1], args[2]);
  } else if (action === "copy-prices") {
    await copyPrices(args[0], args[1], args[2], args[3]);
  } else if (action === "copy-coupons") {
    await copyCoupons(args[0], args[1], args[2]);
  } else if (action === "copy-promotion-codes") {
    await copyPromotionCodes(args[0], args[1], args[2], args[3]);
  } else if (action === "has-api-subscription-write-access") {
    await hasApiSubscriptionWriteAccess(args[0], args[1]);
  } else if (action === "get-payment-methods") {
    await getPaymentMethods(args[0], args[1]);
  } else if (action === "copy-invoices") {
    await copyInvoices(args[0], args[1], args[2], args[3]);
  } else if (action === "copy-subscriptions") {
    await copySubscriptions(
      args[0],
      args[1],
      args[2] === "true" ? true : false,
      args[3],
      args[4]
    );
  } else if (action === "copy-subscriptions-inline-items") {
    await copySubscriptionsInlineItems(args[0], args[1], args[2]);
  } else if (action === "set-default-payment-method") {
    await setDefaultPaymentMethod(args[0]);
  } else if (action === "cancel-all-subscriptions") {
    await cancelAllSubscriptions(args[0]);
  } else if (action === "pause-all-subscriptions") {
    await pauseAllSubscriptions(args[0]);
  } else if (action === "apply-customer-coupons") {
    await applyCustomerCoupons(args[0], args[1], args[2]);
  } else {
    throw new Error("Unknown command");
  }
}

const args = process.argv.slice(2);

main(args[0], args.slice(1))
  .then(() => {
    console.log("completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
