// index.js
// Main integration definition registering authentication, triggers, and creates.
"use strict";

const authentication = require("./authentication");
const failedChargeTrigger = require("./triggers/failed_charge");
const triagePaymentCreate = require("./creates/triage_payment");

module.exports = {
  version: require("./package.json").version,
  platformVersion: require("zapier-platform-core").version,
  authentication,
  triggers: {
    [failedChargeTrigger.key]: failedChargeTrigger,
  },
  searches: {},
  creates: {
    [triagePaymentCreate.key]: triagePaymentCreate,
  },
};
