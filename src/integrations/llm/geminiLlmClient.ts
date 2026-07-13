import { LlmClient, LlmDecision } from './llmClient.js';
import { env } from '../../config/env.js';
import { UpstreamProviderError } from '../../errors/index.js';

export class GeminiLlmClient implements LlmClient {
  async processSpeech(
    catalog: any[],
    currentBasket: any[],
    history: { speaker: 'customer' | 'maame'; text: string; timestamp: string | Date }[],
    newUserUtterance: string,
  ): Promise<LlmDecision> {
    try {
      // Find currently locked vendor based on items in the basket
      const lockedVendorId = currentBasket.length > 0 ? currentBasket[0].vendorId : null;
      const lockedVendorName = lockedVendorId 
        ? (catalog.find(p => p.vendorId === lockedVendorId)?.vendorName || 'the selected vendor')
        : null;

      const systemPrompt = `You are Maame, a friendly AI voice ordering assistant for local food joints in Ghana.
Your job is to process the customer's input and produce a structured JSON decision mapping their intent and matched catalog products.

Here is the current vendor catalog of products:
${JSON.stringify(catalog, null, 2)}

Rules:
1. Identify the user's intent: 'add_item', 'remove_item', 'ask_clarification', 'confirm_order', 'cancel'.
2. Under matchedItems, list any products matched from the catalog with a confidence score (0.0 to 1.0) and product ID.
3. SINGLE VENDOR CONSTRAINT: A customer can only order from one vendor in a single call.
   - The current locked vendor ID is: ${lockedVendorId ? `'${lockedVendorId}' (${lockedVendorName})` : 'None (first added item will lock the vendor)'}.
   - If a vendor is locked, and the customer tries to add items belonging to a DIFFERENT vendor, you MUST set intent to 'ask_clarification' and clarifyingQuestion to explain they can only order from the currently locked vendor (provide the vendor name).
   - If no vendor is locked, the first item added locks the order to that item's vendor.
4. When intent is 'confirm_order', summarize the final order items, quantities, and total cost in Cedis in 'orderSummaryText' (e.g. "You ordered 1 portion of Waakye with egg. The total is 18 Cedis. Would you like to confirm this order?").
5. Provide a clarifyingQuestion when intent is 'ask_clarification' or when you need details (e.g. "Do you want to add fish, egg, or beef to your Waakye?").
6. You MUST respond with a JSON object matching the requested schema.`;

      const promptContext = `Current Basket State:
${JSON.stringify(currentBasket, null, 2)}

Conversation Turn History:
${history.map(h => `${h.speaker}: ${h.text}`).join('\n')}

New Customer Utterance:
"${newUserUtterance}"`;

      // Call Gemini REST API
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${env.GOOGLE_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: promptContext }],
            },
          ],
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                intent: {
                  type: 'STRING',
                  enum: ['add_item', 'remove_item', 'ask_clarification', 'confirm_order', 'cancel'],
                },
                matchedItems: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      productId: { type: 'STRING' },
                      quantity: { type: 'INTEGER' },
                      confidence: { type: 'NUMBER' },
                    },
                    required: ['productId', 'quantity', 'confidence'],
                  },
                },
                clarifyingQuestion: { type: 'STRING', nullable: true },
                orderSummaryText: { type: 'STRING', nullable: true },
              },
              required: ['intent', 'matchedItems', 'clarifyingQuestion', 'orderSummaryText'],
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
      }

      const resultJson = (await response.json()) as {
        candidates?: {
          content?: {
            parts?: {
              text?: string;
            }[];
          };
        }[];
      };
      const text = resultJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini API returned empty response candidate');
      }

      const decision = JSON.parse(text) as LlmDecision;

      // Normalize null values
      return {
        intent: decision.intent,
        matchedItems: decision.matchedItems || [],
        clarifyingQuestion: decision.clarifyingQuestion || null,
        orderSummaryText: decision.orderSummaryText || null,
      };
    } catch (error: any) {
      throw new UpstreamProviderError(`Gemini LLM client failed: ${error.message}`);
    }
  }
}
export default GeminiLlmClient;
