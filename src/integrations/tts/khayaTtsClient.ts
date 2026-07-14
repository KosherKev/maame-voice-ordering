import { TtsClient } from './ttsClient.js';
import { env } from '../../config/env.js';
import { UpstreamProviderError } from '../../errors/index.js';

export class KhayaTtsClient implements TtsClient {
  async synthesize(text: string, languageCode: string): Promise<Buffer> {
    try {
      const response = await fetch('https://translation-api.ghananlp.org/tts/v2/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': env.KHAYA_API_KEY,
        },
        body: JSON.stringify({
          text,
          language: languageCode,
          format: 'wav',
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Khaya TTS API returned status ${response.status}: ${errorText}`);
      }

      const arrayBuf = await response.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch (error: any) {
      throw new UpstreamProviderError(`Khaya TTS synthesis failed: ${error.message}`);
    }
  }
}
export default KhayaTtsClient;
