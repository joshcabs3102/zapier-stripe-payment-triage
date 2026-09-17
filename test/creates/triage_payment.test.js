// test/creates/triage_payment.test.js
// Automated test suite for the payment triage action.
"use strict";

const zapier = require("zapier-platform-core");
const App = require("../../index");

describe("creates.triage_payment", () => {
  zapier.tools.env.inject();

  const authData = {
    supabase_url: "https://mock.supabase.co",
    supabase_key: "mock_key",
    slack_webhook_url: "https://hooks.slack.com/services/mock",
    postmark_token: "POSTMARK_API_TEST",
  };

  it("routes high-value customer (LTV >= $5,000) to Slack", async () => {
    const bundle = {
      authData,
      inputData: {
        customer_id: "cus_HIGH_VAL_001",
        amount_cents: 25000,
        customer_email: "buyer@acmecorp.com",
        failure_code: "card_declined",
      },
    };

    const perform = App.creates.triage_payment.operation.perform;
    const mockZ = {
      request: jest.fn().mockImplementation(async (opts) => {
        if (opts.url.includes("/rest/v1/customers")) {
          return {
            status: 200,
            data: [
              {
                stripe_customer_id: "cus_HIGH_VAL_001",
                lifetime_value: 650000,
              },
            ],
          };
        }
        if (opts.url.includes("hooks.slack.com")) {
          return { status: 200, content: "ok" };
        }
        return { status: 400 };
      }),
      errors: zapier.errors,
    };

    const result = await perform(mockZ, bundle);
    expect(result.status).toBe("escalated");
    expect(result.route).toBe("slack_ae");
    expect(result.ltv).toBe(650000);
    expect(mockZ.request).toHaveBeenCalledTimes(2);
  });

  it("routes self-serve customer (LTV < $5,000) to Postmark", async () => {
    const bundle = {
      authData,
      inputData: {
        customer_id: "cus_LOW_VAL_002",
        amount_cents: 2900,
        customer_email: "developer@starter.io",
        failure_code: "insufficient_funds",
      },
    };

    const perform = App.creates.triage_payment.operation.perform;
    const mockZ = {
      request: jest.fn().mockImplementation(async (opts) => {
        if (opts.url.includes("/rest/v1/customers")) {
          return {
            status: 200,
            data: [
              { stripe_customer_id: "cus_LOW_VAL_002", lifetime_value: 120000 },
            ],
          };
        }
        if (opts.url.includes("postmarkapp.com")) {
          return { status: 200, content: '{"ErrorCode":0,"Message":"OK"}' };
        }
        return { status: 400 };
      }),
      errors: zapier.errors,
    };

    const result = await perform(mockZ, bundle);
    expect(result.status).toBe("dunning_sent");
    expect(result.route).toBe("postmark");
    expect(result.ltv).toBe(120000);
    expect(mockZ.request).toHaveBeenCalledTimes(2);
  });
});
