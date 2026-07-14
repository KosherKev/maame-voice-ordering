import { AsrClient } from './asrClient.js';
import { env } from '../../config/env.js';
import { UpstreamProviderError } from '../../errors/index.js';

/**
 * Determines the Content-Type for raw audio based on file magic bytes.
 * Falls back to audio/mpeg if the format cannot be detected.
 */
function detectAudioContentType(buffer: Buffer): string {
  // WAV: RIFF....WAVE
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WAVE') {
    return 'audio/wav';
  }
  // FLAC: fLaC
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'fLaC') {
    return 'audio/flac';
  }
  // OGG: OggS
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'OggS') {
    return 'audio/ogg';
  }
  // MP3: ID3 tag or 0xFF 0xE* / 0xFF 0xF* sync word
  if (buffer.length >= 3 && buffer.subarray(0, 3).toString('ascii') === 'ID3') {
    return 'audio/mpeg';
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return 'audio/mpeg';
  }
  // Default to MP3 — most common format from Africa's Talking recordings
  return 'audio/mpeg';
}

export class KhayaAsrClient implements AsrClient {
  /**
   * Transcribes audio using the Khaya ASR v3 API.
   *
   * Endpoint: POST https://translation-api.ghananlp.org/asr/v3/transcribe?language={code}
   * Body:     Raw audio bytes (audio/mpeg | audio/wav | audio/flac | audio/ogg)
   * Response: { "text": "..." }
   *
   * Ref: https://translation.ghananlp.org/api-details#api=khaya-ai-automatic-speech-recognition-api-v3
   */
  async transcribe(audioUrlOrBuffer: string | Buffer, languageCode: string): Promise<string> {
    try {
      if (!audioUrlOrBuffer) {
        throw new Error('No audio provided for transcription.');
      }

      let buffer: Buffer;

      if (typeof audioUrlOrBuffer === 'string') {
        const downloadRes = await fetch(audioUrlOrBuffer);
        if (!downloadRes.ok) {
          throw new Error(
            `Failed to download audio from ${audioUrlOrBuffer}. Status: ${downloadRes.status}`,
          );
        }
        const arrayBuf = await downloadRes.arrayBuffer();
        buffer = Buffer.from(arrayBuf);
      } else {
        buffer = audioUrlOrBuffer;
      }

      const contentType = detectAudioContentType(buffer);
      const url = `https://translation-api.ghananlp.org/asr/v3/transcribe?language=${encodeURIComponent(languageCode)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'Ocp-Apim-Subscription-Key': env.KHAYA_API_KEY,
        },
        body: buffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Khaya ASR API returned status ${response.status}: ${errorText}`);
      }

      const result = await response.json() as { text: string };
      return result.text ?? '';
    } catch (error: any) {
      throw new UpstreamProviderError(`Khaya ASR transcription failed: ${error.message}`);
    }
  }
}

export default KhayaAsrClient;
