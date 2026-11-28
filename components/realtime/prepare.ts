import { isRecord } from "../../lib/case/validate.ts";

interface Credential { clientSecret: string; expiresAt: number }
export interface PreparedMedia { peer: RTCPeerConnection; channel: RTCDataChannel; stream: MediaStream; offer: RTCSessionDescriptionInit }

// One selection owns its credential and local media. No SDP is sent before Start.
export class RealtimePreparation {
  readonly caseId: string;
  readonly personalityId: string;
  private abort = new AbortController();
  private credential: Credential | null = null;
  private fetching: Promise<Credential> | null = null;
  private preparing: Promise<PreparedMedia> | null = null;
  private media: PreparedMedia | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private taking = false;
  private peer: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;

  constructor(caseId: string, personalityId: string) {
    this.caseId = caseId;
    this.personalityId = personalityId;
  }

  async prefetch(): Promise<Credential> {
    this.abort.signal.throwIfAborted();
    if (this.credential && this.credential.expiresAt * 1000 > Date.now() + 30_000) return this.credential;
    if (this.fetching) return this.fetching;
    this.credential = null;
    this.fetching = (async () => {
      const response = await fetch("/api/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: this.caseId, personalityId: this.personalityId }),
        signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(30_000)]),
      });
      if (!response.ok) throw new Error("Voice is unavailable. Check your API key and quota, or continue in text mode.");
      const value: unknown = await response.json();
      this.abort.signal.throwIfAborted();
      if (!isRecord(value) || typeof value.clientSecret !== "string" || !value.clientSecret || typeof value.expiresAt !== "number"
        || !Number.isFinite(value.expiresAt) || value.expiresAt * 1000 <= Date.now() + 30_000) throw new Error("Voice credential expired. Please try again.");
      this.credential = { clientSecret: value.clientSecret, expiresAt: value.expiresAt };
      return this.credential;
    })();
    try { return await this.fetching; } finally { this.fetching = null; }
  }

  // Call only from a click/keyboard handler, including Start for the default case.
  prepare(): Promise<PreparedMedia> {
    this.abort.signal.throwIfAborted();
    if (this.media?.stream.getTracks().some(track => track.readyState === "ended")) { this.releaseMedia(); this.preparing = null; }
    if (this.preparing) return this.preparing;
    this.preparing = this.prepareMedia();
    void this.preparing.catch(() => { this.releaseMedia(); this.preparing = null; });
    return this.preparing;
  }

  private async prepareMedia(): Promise<PreparedMedia> {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error("Voice needs a supported browser on HTTPS or localhost. You can still type below.");
    const peer = new RTCPeerConnection();
    this.peer = peer;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    if (this.abort.signal.aborted) { stream.getTracks().forEach(track => track.stop()); peer.close(); this.abort.signal.throwIfAborted(); }
    this.stream = stream;
    stream.getTracks().forEach(track => { track.enabled = false; peer.addTrack(track, stream); });
    const channel = peer.createDataChannel("oai-events");
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    this.abort.signal.throwIfAborted();
    this.media = { peer, stream, channel, offer };
    if (!this.taking) this.idleTimer = setTimeout(() => { this.releaseMedia(); this.preparing = null; }, 60_000);
    return this.media;
  }

  async take(): Promise<PreparedMedia & Credential> {
    this.taking = true;
    clearTimeout(this.idleTimer);
    const [media, credential] = await Promise.all([this.prepare(), this.prefetch()]);
    this.abort.signal.throwIfAborted();
    // A permission dialog can outlive the credential's useful lifetime.
    const fresh = credential.expiresAt * 1000 > Date.now() + 30_000 ? credential : await this.prefetch();
    this.abort.signal.throwIfAborted();
    clearTimeout(this.idleTimer);
    this.media = null;
    this.peer = null;
    this.stream = null;
    this.preparing = null;
    this.credential = null;
    return { ...media, ...fresh };
  }

  private releaseMedia(): void {
    clearTimeout(this.idleTimer);
    this.media?.channel.close();
    this.peer?.close();
    this.stream?.getTracks().forEach(track => track.stop());
    this.media = null;
    this.peer = null;
    this.stream = null;
  }

  close(): void {
    this.abort.abort();
    this.credential = null;
    this.releaseMedia();
  }
}
