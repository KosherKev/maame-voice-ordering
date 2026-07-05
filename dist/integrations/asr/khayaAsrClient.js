"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KhayaAsrClient = void 0;
const env_js_1 = require("../../config/env.js");
const index_js_1 = require("../../errors/index.js");
class KhayaAsrClient {
    async transcribe(audioUrlOrBuffer, languageCode) {
        try {
            let buffer;
            if (typeof audioUrlOrBuffer === 'string') {
                const downloadRes = await fetch(audioUrlOrBuffer);
                if (!downloadRes.ok) {
                    throw new Error(`Failed to download audio from ${audioUrlOrBuffer}. Status: ${downloadRes.status}`);
                }
                const arrayBuf = await downloadRes.arrayBuffer();
                buffer = Buffer.from(arrayBuf);
            }
            else {
                buffer = audioUrlOrBuffer;
            }
            // Construct FormData for multipart upload
            const formData = new FormData();
            const blob = new Blob([buffer], { type: 'audio/mpeg' });
            formData.append('file', blob, 'audio.mp3');
            formData.append('language', languageCode);
            const response = await fetch('https://translation-api.ghananlp.org/v1/asr', {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': env_js_1.env.KHAYA_API_KEY,
                },
                body: formData,
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Khaya ASR API returned status ${response.status}: ${errorText}`);
            }
            const result = await response.json();
            if (typeof result === 'string') {
                return result;
            }
            return result.text || '';
        }
        catch (error) {
            throw new index_js_1.UpstreamProviderError(`Khaya ASR transcription failed: ${error.message}`);
        }
    }
}
exports.KhayaAsrClient = KhayaAsrClient;
exports.default = KhayaAsrClient;
