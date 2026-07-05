"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoolreClient = exports.llmClient = exports.moolreClient = exports.ttsClient = exports.asrClient = void 0;
const env_js_1 = require("../config/env.js");
const khayaAsrClient_js_1 = require("./asr/khayaAsrClient.js");
const khayaTtsClient_js_1 = require("./tts/khayaTtsClient.js");
const geminiLlmClient_js_1 = require("./llm/geminiLlmClient.js");
const claudeLlmClient_js_1 = require("./llm/claudeLlmClient.js");
const moolreClient_js_1 = require("./moolre/moolreClient.js");
Object.defineProperty(exports, "MoolreClient", { enumerable: true, get: function () { return moolreClient_js_1.MoolreClient; } });
exports.asrClient = new khayaAsrClient_js_1.KhayaAsrClient();
exports.ttsClient = new khayaTtsClient_js_1.KhayaTtsClient();
exports.moolreClient = new moolreClient_js_1.MoolreClient();
exports.llmClient = env_js_1.env.LLM_PROVIDER === 'claude'
    ? new claudeLlmClient_js_1.ClaudeLlmClient()
    : new geminiLlmClient_js_1.GeminiLlmClient();
