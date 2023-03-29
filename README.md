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

# set default payment method of customer when it is not assigned yet
yarn start set-default-payment-method TARGET_API_KEY

# The subsequent command generates new IDs within the target account.
# The resulting CSV file supplies an ID mapping from the source to the target account.
# Utilize this table to modify your application accordingly, if required.

# copy subscriptions to new account and cancel subscriptions in old account
yarn start copy-subscriptions 'path/to/prices.csv' 'path/to/subscriptions.csv' true SOURCE_API_KEY TARGET_API_KEY

```
