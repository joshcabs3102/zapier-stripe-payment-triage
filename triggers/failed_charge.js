// triggers/failed_charge.js
// Polling trigger querying Stripe's /v1/charges API directly using the test secret key.
"use strict";

const perform = async (z, bundle) => {
  const response = await z.request({
    url: "https://api.stripe.com/v1/charges",
    params: {
      limit: 10,
    },
    headers: {
      Authorization: `Bearer ${bundle.authData.stripe_secret_key}`,
    },
  });

  if (response.status >= 400) {
    throw new z.errors.Error(
      `Stripe charges request failed with HTTP status ${response.status}: ${response.content}`,
      "StripeQueryError",
      response.status,
    );
  }

  const payload = response.data || JSON.parse(response.content);
  const charges = Array.isArray(payload.data) ? payload.data : [];

  // Filter for failed payments (status is 'failed' or failure_code is populated)
  const failedCharges = charges.filter((charge) => {
    return charge.status === "failed" || charge.failure_code !== null;
  });

  // Map to standardized schema for downstream actions
  return failedCharges.map((charge) => ({
    id: charge.id,
    customer_id: typeof charge.customer === "string" ? charge.customer : "",
    amount_cents: typeof charge.amount === "number" ? charge.amount : 0,
    customer_email:
      (charge.billing_details && charge.billing_details.email) ||
      charge.receipt_email ||
      "",
    failure_code:
      charge.failure_code ||
      (charge.outcome && charge.outcome.reason) ||
      "card_declined",
    failure_message: charge.failure_message || "Payment charge failed",
    created_at: new Date(charge.created * 1000).toISOString(),
  }));
};

module.exports = {
  key: "failed_charge",
  noun: "Failed Charge",
  display: {
    label: "New Failed Charge",
    description:
      "Triggers when a charge fails in Stripe (works with unactivated test and sandbox accounts).",
  },
  operation: {
    perform,
    sample: {
      id: "ch_3MtwLwLkdIwHu7ix0snssm",
      customer_id: "cus_VGqzmn7slsnSPH",
      amount_cents: 25000,
      customer_email: "buyer@acmecorp.com",
      failure_code: "card_declined",
      failure_message: "Your card was declined.",
      created_at: "2026-09-16T22:00:00.000Z",
    },
    outputFields: [
      { key: "id", label: "Charge ID", type: "string" },
      { key: "customer_id", label: "Customer ID", type: "string" },
      { key: "amount_cents", label: "Amount (in Cents)", type: "integer" },
      { key: "customer_email", label: "Customer Email", type: "string" },
      { key: "failure_code", label: "Failure Code", type: "string" },
      { key: "failure_message", label: "Failure Message", type: "string" },
      { key: "created_at", label: "Timestamp Created", type: "datetime" },
    ],
  },
};
