// Raw RMS thresholds, before the visual meter's gain/smoothing. Silence hangover
// keeps tiny intra-word gaps from ending speech; onset dwell rejects isolated clicks.
export class TurnEnergy {
  private lastMic: number | null = null;
  private remoteSince: number | null = null;
  private remoteVoiced = false;

  sample(now: number, mic: number, remote: number): { silenceAt: number | null; audibleAt: number | null } {
    if (mic >= 0.015) this.lastMic = now;
    let audibleAt: number | null = null;
    if (remote >= 0.008) {
      this.remoteSince ??= now;
      if (!this.remoteVoiced && now - this.remoteSince >= 25) {
        this.remoteVoiced = true;
        audibleAt = this.remoteSince;
      }
    } else {
      this.remoteSince = null;
      this.remoteVoiced = false;
    }
    return { silenceAt: this.lastMic !== null && now - this.lastMic >= 120 ? this.lastMic : null, audibleAt };
  }
}
