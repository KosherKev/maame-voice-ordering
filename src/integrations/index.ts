import { env } from '../config/env.js';
import { AsrClient } from './asr/asrClient.js';
import { KhayaAsrClient } from './asr/khayaAsrClient.js';
import { TtsClient } from './tts/ttsClient.js';
import { KhayaTtsClient } from './tts/khayaTtsClient.js';
import { LlmClient } from './llm/llmClient.js';
import { GeminiLlmClient } from './llm/geminiLlmClient.js';
import { ClaudeLlmClient } from './llm/claudeLlmClient.js';
import { MoolreClient } from './moolre/moolreClient.js';

export const asrClient: AsrClient = new KhayaAsrClient();
export const ttsClient: TtsClient = new KhayaTtsClient();
export const moolreClient = new MoolreClient();

export const llmClient: LlmClient = env.LLM_PROVIDER === 'claude' 
  ? new ClaudeLlmClient() 
  : new GeminiLlmClient();

export { AsrClient, TtsClient, LlmClient, MoolreClient };
export { LlmDecision } from './llm/llmClient.js';
export { PaymentClient, NotificationClient, TransferClient } from './moolre/interfaces.js';
