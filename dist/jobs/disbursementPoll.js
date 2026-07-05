"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDisbursementPoll = runDisbursementPoll;
const fulfillmentService_js_1 = require("../services/fulfillmentService.js");
/**
 * Background runner checking transaction status of pending vendor payouts.
 */
async function runDisbursementPoll() {
    try {
        await fulfillmentService_js_1.fulfillmentService.pollPendingDisbursements();
    }
    catch (error) {
        console.error('❌ Error running disbursement status check job:', error);
    }
}
