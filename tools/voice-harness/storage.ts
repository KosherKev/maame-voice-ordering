import fs from 'fs/promises';
import path from 'path';

export interface HarnessSessionData {
  sessionId: string;
  language: 'en' | 'tw';
  orderState: 'collecting_items' | 'confirming_order' | 'awaiting_payment' | 'completed' | 'abandoned';
  basket: Array<{
    productId: string;
    quantity: number;
    unitPriceInPesewas: number;
    vendorId: string;
  }>;
  lockedVendorId: string | null;
  turns: Array<{
    turnNumber: number;
    transcript: string;
    llmDecision: any;
    orderState: string;
    assistantAudioBase64?: string;
    mockedActions: string[];
  }>;
  createdAt: string;
}

const BASE_DIR = path.join(process.cwd(), '.dev-voice-harness');

export async function createSessionStorage(sessionId: string, language: 'en' | 'tw'): Promise<HarnessSessionData> {
  const sessionDir = path.join(BASE_DIR, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });

  const sessionData: HarnessSessionData = {
    sessionId,
    language,
    orderState: 'collecting_items',
    basket: [],
    lockedVendorId: null,
    turns: [],
    createdAt: new Date().toISOString(),
  };

  await saveSessionStorage(sessionId, sessionData);
  return sessionData;
}

export async function getSessionStorage(sessionId: string): Promise<HarnessSessionData | null> {
  const sessionPath = path.join(BASE_DIR, sessionId, 'session.json');
  try {
    const data = await fs.readFile(sessionPath, 'utf-8');
    return JSON.parse(data) as HarnessSessionData;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

export async function saveSessionStorage(sessionId: string, data: HarnessSessionData): Promise<void> {
  const sessionDir = path.join(BASE_DIR, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });
  const sessionPath = path.join(sessionDir, 'session.json');
  await fs.writeFile(sessionPath, JSON.stringify(data, null, 2));
}

export async function deleteSessionStorage(sessionId: string): Promise<boolean> {
  const sessionDir = path.join(BASE_DIR, sessionId);
  try {
    await fs.rm(sessionDir, { recursive: true, force: true });
    return true;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return false;
    }
    throw err;
  }
}

export async function getSessionAudioPath(sessionId: string, filename: string): Promise<string> {
  const sessionDir = path.join(BASE_DIR, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });
  return path.join(sessionDir, filename);
}
