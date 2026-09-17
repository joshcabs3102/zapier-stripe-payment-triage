// authentication.js
// Defines credentials for Stripe, Supabase, Slack, and Postmark with connectivity validation.
"use strict";

const test = async (z, bundle) => {
  // 1. Validate Stripe credentials against the charges API
  const stripeResponse = await z.request({
    url: "https://api.stripe.com/v1/charges",
    params: { limit: 1 },
    headers: {
      Authorization: `Bearer ${bundle.authData.stripe_secret_key}`,
    },
  });

  if (stripeResponse.status !== 200) {
    throw new z.errors.Error(
      `Failed to authenticate with Stripe: Received HTTP ${stripeResponse.status}. Please check your sk_test_... key.`,
      "StripeAuthenticationError",
      stripeResponse.status,
    );
  }

  // 2. Validate Supabase credentials against the customers table
  const supabaseResponse = await z.request({
    url: `${bundle.authData.supabase_url}/rest/v1/customers`,
    params: { limit: 1 },
    headers: {
      apikey: bundle.authData.supabase_key,
      Authorization: `Bearer ${bundle.authData.supabase_key}`,
    },
  });

  if (supabaseResponse.status !== 200) {
    throw new z.errors.Error(
      `Failed to authenticate with Supabase: Received HTTP ${supabaseResponse.status}.`,
      "SupabaseAuthenticationError",
      supabaseResponse.status,
    );
  }

  return { verified: true };
};

module.exports = {
  type: "custom",
  test,
  fields: [
    {
      key: "stripe_secret_key",
      label: "Stripe Secret API Key (Test)",
      type: "string",
      required: true,
      helpText:
        "Your Stripe test secret key (starts with sk_test_...). Works in Sandbox with no merchant activation.",
    },
    {
      key: "supabase_url",
      label: "Supabase Project URL",
      type: "string",
      required: true,
      helpText:
        "Base URL of your Supabase instance (e.g. https://your-project.supabase.co)",
    },
    {
      key: "supabase_key",
      label: "Supabase Anon API Key",
      type: "string",
      required: true,
      helpText:
        "The anon key copied from the Legacy anon, service_role API keys tab",
    },
    {
      key: "slack_webhook_url",
      label: "Slack Incoming Webhook URL",
      type: "string",
      required: true,
      helpText: "Incoming Webhook URL targeting your alerts channel",
    },
    {
      key: "postmark_token",
      label: "Postmark Server API Token",
      type: "string",
      required: true,
      helpText: "Postmark server token (use POSTMARK_API_TEST for testing)",
    },
  ],
  connectionLabel: "Triage Engine ({{bundle.authData.supabase_url}})",
};
