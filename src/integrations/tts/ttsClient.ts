export interface TtsClient {
  /**
   * Synthesizes text to speech audio bytes.
   * @param text The text to synthesize
   * @param languageCode ISO 639-3 language code (e.g. "tw", "gaa")
   * @returns Binary audio buffer
   */
  synthesize(text: string, languageCode: string): Promise<Buffer>;
}
