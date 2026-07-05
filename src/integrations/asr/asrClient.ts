export interface AsrClient {
  /**
   * Transcribes the provided audio (URL to file or binary buffer) using the specified language.
   * @param audioUrlOrBuffer Audio file URL or binary audio buffer
   * @param languageCode ISO 639-3 language code (e.g. "tw", "gaa")
   */
  transcribe(audioUrlOrBuffer: string | Buffer, languageCode: string): Promise<string>;
}
