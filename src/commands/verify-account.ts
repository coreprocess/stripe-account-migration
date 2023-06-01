import { createStripeClient } from "../core/stripe";
import { calculateRemainingDuration } from "../core/utils";
import Stripe from "stripe";

const displayDiscount = (discount: Stripe.Discount) => {
  const coupon = discount.coupon as Stripe.Coupon;
  const promoCode = discount.promotion_code as Stripe.PromotionCode;

  // console.log(discount);
  let show = {} as any;
  if (coupon && coupon.livemode) {
    const discountstart = new Date(discount.start * 1000);
    show.coupon = coupon.id;
    show.name = coupon.name;
    show.percent_off = coupon.percent_off;
    show.amount_off = coupon.amount_off;
    show.duration = coupon.duration;
    show.duration_in_months = coupon.duration_in_months;

    if (coupon && coupon.duration === 'repeating' && coupon.duration_in_months) {
      show.newDuration = calculateRemainingDuration(discountstart, coupon.duration_in_months);
    }

    show.created = new Date(coupon.created * 1000).toLocaleDateString();

    let discountend;
    if (discount.end) {
      discountend = new Date(discount.end * 1000);
      show.end = discountend.toLocaleDateString();
      // let daysleft = Math.round((discountend.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    }
  show.start = discountstart.toLocaleDateString();
  } else if (promoCode) {
    show.activePromoCode = promoCode.active ? 'true' : 'false';
    show.promoCode = promoCode.id;
    if (promoCode.coupon) {
      show.promotion_code = promoCode.coupon.id;
    }
  }


  return show;
}

const checkDiscounts = (sub: Stripe.Subscription, customer: Stripe.Customer) => {
  let ret = {} as any;
  if (sub.discount) {
    ret = displayDiscount(sub.discount);
    ret.email = customer.email;
    ret.subscriptionId = sub.id;
    ret.customerId = customer.id;
    return ret;
  }
  return null;
};

const checkProps = (sub: Stripe.Subscription) => {
  console.log(sub);
}

const checkCustomer = (c: Stripe.Customer) => {
  // console.log(c);
  if (c.discount) {
    let ret = displayDiscount(c.discount);
    ret.email = c.email;
    ret.customerId = c.id;
    return ret;
  }
}

export async function verifyAccount(apiKey: string) {
  /*
  const data = await createStripeClient(apiKey).accounts.retrieve({});
  console.log(data);
  */
  let items = [] as any[];

  // validate payment methods will be migrated (not ACH)
  const stripe = await createStripeClient(apiKey);

  // count total count of subscriptions:
  let i = 0;
  let bad = 0;
  let promo = 0;
  const subCount = await stripe.subscriptions
    .list({ limit: 100 })
    .autoPagingEach(async (sub) => {
      /*
      if (sub.collection_method !== 'charge_automatically') {
        console.log('BAD COLLECTION METHOD!', sub.id, 'Have days_until due:', sub.days_until_due);
        bad++;
      }
      */
      if (sub.discount && sub.discount.promotion_code) {
        console.log('PROMO CODE!', sub.discount.promotion_code);
        console.log(sub.discount.coupon ? sub.discount.coupon.id : 'NO COUPON ID');
        promo++;
      }
      i++;
    });
  
  console.log('Total subscriptions:', i);
  console.log('Bad subscriptions:', bad);
  console.log('Subs with PROMO CODE:', promo);
  return;

  /*
  console.log('Checking automatic tax...');
  await stripe.subscriptions.list()
    .autoPagingEach(async (sub) => {
      if (sub.automatic_tax?.enabled) {
        console.log('------------------------------------------------');
        console.log('Automatic tax enabled!');
        console.log(sub.id);
      }
    })
    .catch((err) => {
      console.log(err);
    })
    .finally(() => {
      console.log('Finished checking automatic tax!')
    });
  return;
  */

  console.log('Looking for payment methods for all customers');
  await stripe.customers.list()
    .autoPagingEach(async (customer) => {

      // check payment methods
      /*
      const pm = await stripe.customers.listPaymentMethods(customer.id, { type: 'card' });
      pm.data.forEach((method) => {
        console.log('------------------------------------------------');
        if (method.card?.brand) {
          if (method.card.brand === 'ach_credit_transfer') {
            console.log('ACH payment method found!');
            console.log(method);
            throw new Error('ACH payment method found!');
          } else {
            let s = `Checking customer: ${customer.id} - ${customer.email}`;
            s += ` - Payment method: ${method.card?.brand} - ${method.card?.last4}`;
            console.log(s);
          }
        } else {
          console.log('No payment method found!');
        }
      });
      */

      // check automatic tax
      customer.tax_ids?.data.forEach((tax) => {
        if (tax.type === 'eu_vat') {
          console.log('------------------------------------------------');
          console.log('EU VAT tax ID found!');
          console.log(tax);
          throw new Error('EU VAT tax ID found!');
        }
      });


      
    })
    .catch((err) => {
      console.log(err);
    })
    .finally(() => {
      console.log('Finished processing payment methods!')
    });

  
    return;

  console.log('Looking for customer discounts...');
  await createStripeClient(apiKey)
    .customers.list()
    .autoPagingEach(async (c) => {
      const d = checkCustomer(c);
      if (d) {
        items.push({
          ...d,
          type: 'customer'
        });
      }
    })
    .catch((err) => {
      console.log(err);
    })
    .finally(() => {
      console.log('Finished processing CUSTOMER discounts!')
    });

  console.log('Looking for subscription discounts...');
  await createStripeClient(apiKey)
    .subscriptions.list({
      expand: ['data.customer', 'data.discount']
    })
    .autoPagingEach(async (sub) => {
      // checkProps(sub);
      const customer = sub.customer as Stripe.Customer;
      const d = checkDiscounts(sub, customer);
      if (d) {
        items.push({
          ...d,
          type: 'subscription'
        });
      }
    })
    .catch((err) => {
      console.log(err);
    })
    .finally(() => {
      console.log('Finished processing SUBSCRIPTION discounts!')
    });
  
  console.table(items);

  // turn items into a CSV. Use this headers:
  // (index) │ coupon │ name │ percent_off │ amount_off │ duration │ duration_in_months │ created │ start │ end │ email │ type |

  let csvLines = [];
  csvLines.push('coupon,name,percent_off,amount_off,duration,duration_in_months,newDuration,created,start,end,email,type,customerId,subscriptionId');
  items.forEach((item) => {
    let line = '';
    line += item.coupon ? item.coupon : '';
    line += ',';
    line += item.name ? item.name : '';
    line += ',';
    line += item.percent_off ? item.percent_off : '';
    line += ',';
    line += item.amount_off ? item.amount_off : '';
    line += ',';
    line += item.duration ? item.duration : '';
    line += ',';
    line += item.duration_in_months ? item.duration_in_months : '';
    line += ',';
    line += item.newDuration ? item.newDuration : '';
    line += ',';
    line += item.created ? item.created : '';
    line += ',';
    line += item.start ? item.start : '';
    line += ',';
    line += item.end ? item.end : '';
    line += ',';
    line += item.email ? item.email : '';
    line += ',';
    line += item.type ? item.type : '';
    line += ',';
    line += item.customerId ? item.customerId : '';
    line += ',';
    line += item.subscriptionId ? item.subscriptionId : '';
    csvLines.push(line);
  });

  console.log('------------------------------------------');
  const csv = csvLines.join('\n');
  console.log(csv);

}
