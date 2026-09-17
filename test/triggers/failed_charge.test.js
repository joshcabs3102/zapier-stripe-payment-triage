// test/triggers/failed_charge.test.js
// Unit test suite verifying Stripe failed charge polling and filtering.
"use strict";

const zapier = require("zapier-platform-core");
const App = require("../../index");

describe("triggers.failed_charge", () => {
  zapier.tools.env.inject();

  const authData = {
    stripe_secret_key: "sk_test_mock_secret_key",
  };

  it("filters out successful charges and returns only failed charges", async () => {
    const bundle = { authData };
    const perform = App.triggers.failed_charge.operation.perform;

    const mockZ = {
      request: jest.fn().mockResolvedValue({
        status: 200,
        data: {
          data: [
            {
              id: "ch_SUCCESS_1",
              status: "succeeded",
              failure_code: null,
              amount: 10000,
              customer: "cus_SUCCESS_1",
              billing_details: { email: "success@example.com" },
              created: 1700000000,
            },
            {
              id: "ch_FAILED_2",
              status: "failed",
              failure_code: "card_declined",
              failure_message: "Your card was declined.",
              amount: 25000,
              customer: "cus_VGqzmn7slsnSPH",
              billing_details: { email: "buyer@acmecorp.com" },
              created: 1700000001,
            },
          ],
        },
      }),
      errors: zapier.errors,
    };

    const results = await perform(mockZ, bundle);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("ch_FAILED_2");
    expect(results[0].customer_id).toBe("cus_VGqzmn7slsnSPH");
    expect(results[0].amount_cents).toBe(25000);
    expect(results[0].failure_code).toBe("card_declined");
    expect(mockZ.request).toHaveBeenCalledTimes(1);
  });
});
