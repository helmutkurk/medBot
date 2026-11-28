// USD per 1M tokens, standard API rates. Checked 2026-11-28 against
// https://developers.openai.com/api/docs/pricing and /api/docs/models/<model>.
// Historical aliases remain estimates; no service-tier, regional or tool fees.
export interface TokenPrice { input: number; cachedInput: number; output: number }
export const PRICES: Record<string, { text: TokenPrice; audio?: TokenPrice }> = {
  "gpt-5-mini": { text: { input: 0.25, cachedInput: 0.025, output: 2 } },
  "gpt-5-nano": { text: { input: 0.05, cachedInput: 0.005, output: 0.4 } },
  "gpt-5": { text: { input: 1.25, cachedInput: 0.125, output: 10 } },
  "gpt-4.1-mini": { text: { input: 0.4, cachedInput: 0.1, output: 1.6 } },
  "gpt-realtime": { text: { input: 4, cachedInput: 0.4, output: 16 }, audio: { input: 32, cachedInput: 0.4, output: 64 } },
  "gpt-4o-mini-transcribe": { text: { input: 1.25, cachedInput: 1.25, output: 5 }, audio: { input: 1.25, cachedInput: 1.25, output: 0 } },
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  audioInputTokens?: number;
  audioOutputTokens?: number;
  cachedAudioTokens?: number;
}

export function estimateCost(model: string, usage: TokenUsage): { costUsd: number; unknownModel: boolean } {
  const base = model.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  const prices = Object.hasOwn(PRICES, base) ? PRICES[base] : undefined;
  if (!prices) return { costUsd: 0, unknownModel: true };
  const audioIn = Math.min(usage.inputTokens, usage.audioInputTokens ?? 0);
  const audioOut = Math.min(usage.outputTokens, usage.audioOutputTokens ?? 0);
  const cached = Math.min(usage.inputTokens, usage.cachedTokens ?? 0);
  const cachedAudio = Math.min(audioIn, cached, usage.cachedAudioTokens ?? 0);
  const cachedText = Math.min(usage.inputTokens - audioIn, cached - cachedAudio);
  const audio = prices.audio ?? prices.text;
  // Reasoning tokens are already included in outputTokens.
  const costUsd = ((usage.inputTokens - audioIn - cachedText) * prices.text.input + cachedText * prices.text.cachedInput
    + (usage.outputTokens - audioOut) * prices.text.output
    + (audioIn - cachedAudio) * audio.input + cachedAudio * audio.cachedInput + audioOut * audio.output) / 1_000_000;
  return { costUsd, unknownModel: false };
}
