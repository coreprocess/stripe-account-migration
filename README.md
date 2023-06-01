# Scripts for Stripe to Stripe account migration

## Disclaimer

The scripts provided in this repository are offered free of charge for your convenience. By using these scripts, you acknowledge and agree that Digital Entities GmbH or Revin US1 Corp shall not be held responsible or liable for any direct, indirect, incidental, consequential, or any other damages, losses, or issues that may arise from the use, misuse, or modification of these scripts. It is the responsibility of the user to ensure proper handling of sensitive data and to assess the suitability of these scripts for their specific needs. By using these scripts, you agree to indemnify and hold harmless Digital Entities GmbH or Revin US1 Corp from any claims, liabilities, or legal actions that may result from your use of the scripts. Please exercise due diligence and use at your own risk.

## Getting started

```bash

#### 1. Prepare scripts

# Requirements:
# - Node.js 18 LTS
# - Yarn: corepack enable

# install dependencies and build scripts
yarn
yarn build


#### 2. Copy products, prices and coupons

# The subsequent commands generate new IDs within the target account.
# The resulting CSV files supply an ID mapping from the source to the target account.
# Utilize these tables to modify your application accordingly, if required.

# copy products
yarn start copy-products 'path/to/products.csv' SOURCE_API_KEY TARGET_API_KEY

# copy prices
yarn start copy-prices 'path/to/products.csv' 'path/to/prices.csv' SOURCE_API_KEY TARGET_API_KEY

# copy coupons
yarn start copy-coupons 'path/to/coupons.csv' SOURCE_API_KEY TARGET_API_KEY

# copy promotion codes
yarn start copy-promotion-codes 'path/to/coupons.csv' 'path/to/promotion-codes.csv' SOURCE_API_KEY TARGET_API_KEY


#### 3. Copy customers

# - Follow the instructions at: https://stripe.com/docs/account/data-migrations/pan-copy
# - Ensure that you provide clear instructions to Stripe to maintain the original customer IDs.


#### 4. Copy subscriptions

# apply discount coupons to customers
yarn start apply-customer-coupons 'path/to/coupons.csv' SOURCE_API_KEY TARGET_API_KEY

# set default payment method of customer when it is not assigned yet
yarn start set-default-payment-method TARGET_API_KEY

# The subsequent command generates new IDs within the target account.
# The resulting CSV file supplies an ID mapping from the source to the target account.
# Utilize this table to modify your application accordingly, if required.

# copy subscriptions to new account and cancel subscriptions in old account
yarn start copy-subscriptions 'path/to/prices.csv' 'path/to/subscriptions.csv' true 'path/to/coupons.csv' SOURCE_API_KEY TARGET_API_KEY

```

## Subscription Migration

The `yarn start copy-subscriptions ...` command iterates over all active subscriptions of the source account. 'Active' includes also subscriptions that are canceled at the end of the current billing period. For each subscription, it does the following individually:

1.  It checks if `metadata.migration_destination_id` is set. If that is the case, it assumes the subscription has already been migrated and skips the subscription.

2.  It checks whether the customer exists in the destination account. If that is not the case, the subscription is skipped.

3.  It then creates a new matching subscription in the destination account. Please note:

    a. It creates a subscription with a trial period that covers the billing period already paid for in the old account. For example, if you copy on April 5th and the current billing period ends on April 15th, it creates a subscription with a free trial period from April 5th to April 15th. The first billing period starts on April 15th, matching the end of the current billing period in the old account.

    b. If you pass `true` as the third parameter, as shown in the "Getting started" section above, it will first attempt to create the subscription with activated automatic tax calculation. If that fails due to insufficient location information for the customer, it will then create the subscription with automatic tax disabled and display a warning message.

4.  It will now set the new subscription ID to `metadata.migration_destination_id` in the old account to indicate that the subscription has been copied.

5.  It will then mark the subscription for cancellation at the end of the billing period in the old account.

If the script stops because of an error, you can simply run it again to continue with the migration after the error is resolved. Just pass a new path to the subscription.csv, so you do not lose the previously created subscription mapping. For example, use subscription1.csv, subscription2.csv, and so on.

Please be aware that while the customer IDs remain the same, the subscription IDs, as well as the product and prices, have changed. You need to update your application configuration according to the generateed mapping tables if you depend on these IDs.
