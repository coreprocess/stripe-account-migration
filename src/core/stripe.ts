import Stripe from "stripe";

(() => {
  // check if internal _shouldRetry still exists and has the expected signature
  const StripeResource = Stripe.StripeResource as any;
  if (
    !StripeResource.prototype._shouldRetry ||
    typeof StripeResource.prototype._shouldRetry !== "function"
  ) {
    throw new Error(
      "StripeResource.prototype._shouldRetry no longer exists or not a function"
    );
  }

  const _shouldRetry: Function = StripeResource.prototype._shouldRetry;
  if (_shouldRetry.length !== 4) {
    throw new Error(
      "StripeResource.prototype._shouldRetry does not expect 4 arguments"
    );
  }

  // overwrite _shouldRetry with a function that returns true if the error is a rate limit error
  StripeResource.prototype._shouldRetry = function (
    res: any,
    numRetries: number,
    maxRetries: number,
    error: any
  ) {
    // Retry in case the original function wants a retry.
    const result = _shouldRetry.call(this, res, numRetries, maxRetries, error);
    if (result) {
      return true;
    }

    // Do not retry if we are out of retries.
    if (numRetries >= maxRetries) {
      return false;
    }

    // Retry if we hit a rate limit.
    if (
      res &&
      typeof res.getStatusCode === "function" &&
      res.getStatusCode() === 429
    ) {
      return true;
    }

    // Do not retry.
    return false;
  };
})();

export function createStripeClient(apiKey: string): Stripe {
  return new Stripe(apiKey, {
    apiVersion: "2020-08-27",
    typescript: true,
    maxNetworkRetries: 5,
  });
}
