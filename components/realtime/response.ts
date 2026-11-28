import { isRecord } from "../../lib/case/validate.ts";

export interface ResponseProgress {
  turn: number;
  hasAudio: boolean;
  hasTool: boolean;
  interrupted: boolean;
  done: boolean;
}

// WebRTC can omit raw audio deltas. Completed audio content/transcripts are also
// evidence of speech, even when buffer.started has not reached the data channel.
export function responseHasAudio(response: Record<string, unknown>): boolean {
  return Array.isArray(response.output) && response.output.some(item =>
    isRecord(item) && item.type === "message" && Array.isArray(item.content)
    && item.content.some(part => isRecord(part) && (part.type === "audio" || part.type === "output_audio")));
}

export function needsAudioFollowUp(response: Record<string, unknown>, progress: ResponseProgress, currentTurn: number): boolean {
  const hasTool = progress.hasTool || (Array.isArray(response.output)
    && response.output.some(item => isRecord(item) && item.type === "function_call"));
  return response.status === "completed" && hasTool && !progress.hasAudio
    && !responseHasAudio(response) && !progress.interrupted && !progress.done && progress.turn === currentTurn;
}
