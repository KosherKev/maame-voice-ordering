export interface LlmDecision {
  intent: 'add_item' | 'remove_item' | 'ask_clarification' | 'confirm_order' | 'cancel';
  matchedItems: { productId: string; quantity: number; confidence: number }[];
  clarifyingQuestion: string | null;
  orderSummaryText: string | null;
}

export interface LlmClient {
  /**
   * Processes the speech dialog using catalog and context data to produce a structured ordering decision.
   * @param catalog Simple list of products in the catalog
   * @param currentBasket Currently added items in the order
   * @param history Conversation history turns
   * @param newUserUtterance The new transcribed statement from the customer
   * @returns Structured LLM decision matching the contract schema
   */
  processSpeech(
    catalog: any[],
    currentBasket: any[],
    history: { speaker: 'customer' | 'maame'; text: string; timestamp: Date }[],
    newUserUtterance: string,
  ): Promise<LlmDecision>;
}
