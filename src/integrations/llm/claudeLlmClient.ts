import { LlmClient, LlmDecision } from './llmClient.js';
import { env } from '../../config/env.js';
import { UpstreamProviderError } from '../../errors/index.js';

export class ClaudeLlmClient implements LlmClient {
  async processSpeech(
    catalog: any[],
    currentBasket: any[],
    history: { speaker: 'customer' | 'maame'; text: string; timestamp: string | Date }[],
    newUserUtterance: string,
  ): Promise<LlmDecision> {
    try {
      const lockedVendorId = currentBasket.length > 0 ? currentBasket[0].vendorId : null;
      const lockedVendorName = lockedVendorId 
        ? (catalog.find(p => p.vendorId === lockedVendorId)?.vendorName || 'the selected vendor')
        : null;

      const systemPrompt = `You are Maame, a friendly AI voice ordering assistant for local food joints in Ghana.
Your job is to process the customer's input and produce a structured decision using the tool 'process_dialogue'.

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
5. Provide a conversational response in 'clarifyingQuestion' when intent is 'add_item', 'remove_item', or 'ask_clarification'. (e.g. "I've added Kenkey to your order. Would you like anything else?" or "Do you want fish or egg with that?").`;

      const basketTotalPesewas = currentBasket.reduce((sum, item) => sum + (item.quantity * item.unitPriceInPesewas), 0);
      const basketTotalCedis = (basketTotalPesewas / 100) + 8; // 8 Cedis delivery fee

      const promptContext = `Current Basket State (Total including 8 GHS delivery: ${basketTotalCedis} GHS):
${JSON.stringify(currentBasket, null, 2)}

Conversation Turn History:
${history.map(h => `${h.speaker}: ${h.text}`).join('\n')}

New Customer Utterance:
"${newUserUtterance}"`;

      // Call Anthropic API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: promptContext,
            },
          ],
          tools: [
            {
              name: 'process_dialogue',
              description: 'Output the structured decision of the conversation turn.',
              input_schema: {
                type: 'object',
                properties: {
                  intent: {
                    type: 'string',
                    enum: ['add_item', 'remove_item', 'ask_clarification', 'confirm_order', 'cancel'],
                  },
                  matchedItems: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        productId: { type: 'string' },
                        quantity: { type: 'integer' },
                        confidence: { type: 'number' },
                      },
                      required: ['productId', 'quantity', 'confidence'],
                    },
                  },
                  clarifyingQuestion: { type: 'string', nullable: true },
                  orderSummaryText: { type: 'string', nullable: true },
                },
                required: ['intent', 'matchedItems', 'clarifyingQuestion', 'orderSummaryText'],
              },
            },
          ],
          tool_choice: {
            type: 'tool',
            name: 'process_dialogue',
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API returned status ${response.status}: ${errorText}`);
      }

      const resultJson = (await response.json()) as {
        content?: {
          type: string;
          input?: any;
        }[];
      };
      const toolUseContent = resultJson.content?.find((c) => c.type === 'tool_use');
      
      if (!toolUseContent || !toolUseContent.input) {
        throw new Error('Claude API did not return tool use structure');
      }

      const decision = toolUseContent.input as LlmDecision;

      return {
        intent: decision.intent,
        matchedItems: decision.matchedItems || [],
        clarifyingQuestion: decision.clarifyingQuestion || null,
        orderSummaryText: decision.orderSummaryText || null,
      };
    } catch (error: any) {
      throw new UpstreamProviderError(`Claude LLM client failed: ${error.message}`);
    }
  }
}
export default ClaudeLlmClient;
