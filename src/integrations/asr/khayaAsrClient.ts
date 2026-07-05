import { AsrClient } from './asrClient.js';
import { env } from '../../config/env.js';
import { UpstreamProviderError } from '../../errors/index.js';

export class KhayaAsrClient implements AsrClient {
  async transcribe(audioUrlOrBuffer: string | Buffer, languageCode: string): Promise<string> {
    try {
      let buffer: Buffer;

      if (typeof audioUrlOrBuffer === 'string') {
        const downloadRes = await fetch(audioUrlOrBuffer);
        if (!downloadRes.ok) {
          throw new Error(`Failed to download audio from ${audioUrlOrBuffer}. Status: ${downloadRes.status}`);
        }
        const arrayBuf = await downloadRes.arrayBuffer();
        buffer = Buffer.from(arrayBuf);
      } else {
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
          'Ocp-Apim-Subscription-Key': env.KHAYA_API_KEY,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Khaya ASR API returned status ${response.status}: ${errorText}`);
      }

      const result = await response.json() as { text: string } | string;
      if (typeof result === 'string') {
        return result;
      }
      return result.text || '';
    } catch (error: any) {
      throw new UpstreamProviderError(`Khaya ASR transcription failed: ${error.message}`);
    }
  }
}
export default KhayaAsrClient;
