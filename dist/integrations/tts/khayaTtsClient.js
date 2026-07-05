"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KhayaTtsClient = void 0;
const env_js_1 = require("../../config/env.js");
const index_js_1 = require("../../errors/index.js");
class KhayaTtsClient {
    async synthesize(text, languageCode) {
        try {
            const response = await fetch('https://translation-api.ghananlp.org/v1/tts/synthesize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': env_js_1.env.KHAYA_API_KEY,
                },
                body: JSON.stringify({
                    text,
                    language: languageCode,
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Khaya TTS API returned status ${response.status}: ${errorText}`);
            }
            const arrayBuf = await response.arrayBuffer();
            return Buffer.from(arrayBuf);
        }
        catch (error) {
            throw new index_js_1.UpstreamProviderError(`Khaya TTS synthesis failed: ${error.message}`);
        }
    }
}
exports.KhayaTtsClient = KhayaTtsClient;
exports.default = KhayaTtsClient;
