import { promises as fs } from "fs";
import { csvStringToMap, mapToCsvString } from "../core/csv";
import { createStripeClient } from "../core/stripe";
import { sanitizePromotionCode } from "./sanitize/promotion-code";

export async function copyPromotionCodes(
  couponsFilePath: string,
  promotionCodesFilePath: string,
  apiKeyOldAccount: string,
  apiKeyNewAccount: string
) {
  const coupons = await csvStringToMap(
    await fs.readFile(couponsFilePath, "utf8")
  );

  const keyMap = new Map();

  // https://stripe.com/docs/api/promotion_codes/list
  await createStripeClient(apiKeyOldAccount)
    .promotionCodes.list({ limit: 100 })
    .autoPagingEach(async (oldPromotionCode) => {

      console.log('---------------------------------------------------');
      console.log('Processing promotion code:', oldPromotionCode);
      const newCouponId = coupons.get(oldPromotionCode.coupon.id as string);

      console.log('COUPON >>>>>>>>>>>>>>>>>');
      console.log(oldPromotionCode.coupon, newCouponId);

      if (!newCouponId) {
        console.error("No matching new coupon_id");
        return;
      }

      try {
        const newPromotionCode = await createStripeClient(
          apiKeyNewAccount
        ).promotionCodes.create(
          sanitizePromotionCode(oldPromotionCode, newCouponId)
        );

        keyMap.set(oldPromotionCode.id, newPromotionCode.id);
      } catch (e: any) {
        if(e?.type?.startsWith("Stripe")) {
          console.error(e?.type, e?.raw?.message);
        }
        else {
          throw e;
        }
      }
    });

  await fs.writeFile(promotionCodesFilePath, await mapToCsvString(keyMap));
}
