// creates/triage_payment.js
// Action handler: Queries Supabase for customer LTV, evaluates tier, and conditionally routes alerts to Slack or Postmark.
"use strict";

const LTV_THRESHOLD_CENTS = 500000; // $5,000.00 expressed as an integer in cents

const perform = async (z, bundle) => {
  const { customer_id, amount_cents, failure_code, customer_email } =
    bundle.inputData;

  // 1. Fetch customer context from Supabase via PostgREST
  const dbResponse = await z.request({
    url: `${bundle.authData.supabase_url}/rest/v1/customers`,
    params: { stripe_customer_id: `eq.${customer_id}` },
    headers: {
      apikey: bundle.authData.supabase_key,
      Authorization: `Bearer ${bundle.authData.supabase_key}`,
    },
  });

  if (dbResponse.status >= 400) {
    throw new z.errors.Error(
      `Supabase query failed with status code ${dbResponse.status}: ${dbResponse.content}`,
      "DatabaseError",
      dbResponse.status,
    );
  }

  const customer =
    Array.isArray(dbResponse.data) && dbResponse.data.length > 0
      ? dbResponse.data[0]
      : null;

  const ltv =
    customer && typeof customer.lifetime_value === "number"
      ? customer.lifetime_value
      : 0;

  const isHighValue = ltv >= LTV_THRESHOLD_CENTS;

  // 2. High-value branch: Route to Slack
  if (isHighValue) {
    const slackResponse = await z.request({
      url: bundle.authData.slack_webhook_url,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        text: `Urgent: Failed charge for high-value account ${customer_id}`,
        attachments: [
          {
            color: "#FF0000",
            fields: [
              {
                title: "Amount",
                value: `$${(amount_cents / 100).toFixed(2)}`,
                short: true,
              },
              {
                title: "LTV",
                value: `$${(ltv / 100).toFixed(2)}`,
                short: true,
              },
              {
                title: "Reason",
                value: failure_code || "Unspecified failure",
                short: false,
              },
            ],
          },
        ],
      },
    });

    if (slackResponse.status >= 400) {
      throw new z.errors.Error(
        `Slack notification failed with HTTP status ${slackResponse.status}`,
        "SlackDispatchError",
        slackResponse.status,
      );
    }

    return {
      status: "escalated",
      route: "slack_ae",
      ltv,
      customer_id,
      amount_cents,
    };
  }

  // 3. Self-serve branch: Route to Postmark
  // Fall back to Supabase customer record email if Stripe charge metadata omitted it
  const resolvedEmail =
    customer_email || (customer && customer.email) || "billing@example.com";

  const postmarkResponse = await z.request({
    url: "https://api.postmarkapp.com/email",
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": bundle.authData.postmark_token,
    },
    body: {
      From: "billing@example.com",
      To: resolvedEmail,
      Subject: "Action Required: Payment method update",
      TextBody: `Hello, your renewal payment of $${(amount_cents / 100).toFixed(2)} failed (${failure_code}). Please update your billing details.`,
    },
  });

  if (postmarkResponse.status >= 400) {
    throw new z.errors.Error(
      `Postmark email dispatch failed with HTTP status ${postmarkResponse.status}`,
      "PostmarkDispatchError",
      postmarkResponse.status,
    );
  }

  return {
    status: "dunning_sent",
    route: "postmark",
    ltv,
    customer_id,
    amount_cents,
  };
};

module.exports = {
  key: "triage_payment",
  noun: "Payment Triage",
  display: {
    label: "Triage Failed Payment",
    description:
      "Calculates customer value via Supabase and routes alerts conditionally to Slack or Postmark.",
  },
  operation: {
    perform,
    inputFields: [
      {
        key: "customer_id",
        label: "Stripe Customer ID",
        required: true,
        type: "string",
      },
      {
        key: "amount_cents",
        label: "Charge Amount (in Cents)",
        required: true,
        type: "integer",
      },
      {
        key: "customer_email",
        label: "Customer Email",
        required: false,
        type: "string",
      },
      {
        key: "failure_code",
        label: "Failure Reason Code",
        required: false,
        type: "string",
      },
    ],
    sample: {
      status: "escalated",
      route: "slack_ae",
      ltv: 650000,
      customer_id: "cus_TEST12345",
      amount_cents: 25000,
    },
    outputFields: [
      { key: "status", label: "Execution Status", type: "string" },
      { key: "route", label: "Notification Route Taken", type: "string" },
      { key: "ltv", label: "Customer LTV in Cents", type: "integer" },
      { key: "customer_id", label: "Stripe Customer ID", type: "string" },
      {
        key: "amount_cents",
        label: "Evaluated Amount in Cents",
        type: "integer",
      },
    ],
  },
};
