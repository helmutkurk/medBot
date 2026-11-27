export type VoiceStatus = "Connecting" | "Listening" | "Patient speaking" | "Thinking";

interface VoiceCallbacks {
  onStatus: (status: VoiceStatus) => void;
  onMessage: (role: "student" | "patient", text: string, id: string) => void;
  onFact: (id: string) => void;
  onLatency: (milliseconds: number) => void;
  onLevel: (mic: number, patient: number) => void;
  onError: (message: string) => void;
  onDisconnect: () => void;
}

export class RealtimeInterview {
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private audio: HTMLAudioElement;
  private frame = 0;
  private outAnalyser: AnalyserNode | null = null;
  private closed = false;
  private abort = new AbortController();
  private turnStarted: number | null = null;
  private outputPlaying = false;
  private continueAfterTools = false;
  private handledCalls = new Set<string>();
  private seenMessages = new Set<string>();
  private callbacks: VoiceCallbacks;
  private factIds: Set<string>;

  constructor(callbacks: VoiceCallbacks, factIds: string[]) {
    this.callbacks = callbacks;
    this.factIds = new Set(factIds);
    this.audio = new Audio();
    this.audio.autoplay = true;
  }

  async start(caseId: string, personalityId: string): Promise<void> {
    this.callbacks.onStatus("Connecting");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error("Voice needs a supported browser on HTTPS or localhost. You can still type below.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (this.closed) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      this.meter(stream);
      const response = await fetch("/api/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, personalityId }), signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(30_000)]),
      });
      if (!response.ok) throw new Error("Voice is unavailable. Check your API key and quota, or continue in text mode.");
      const { clientSecret } = await response.json() as { clientSecret: string };
      if (this.closed) return;
      const peer = new RTCPeerConnection();
      this.peer = peer;
      peer.ontrack = event => {
        const remote = event.streams[0] ?? new MediaStream([event.track]);
        this.audio.srcObject = remote;
        this.watchOutput(remote);
        void this.audio.play().catch(() => this.callbacks.onError("Audio playback was blocked. End and restart the interview, then allow audio in your browser."));
      };
      peer.onconnectionstatechange = () => {
        if (!this.closed && (peer.connectionState === "failed" || peer.connectionState === "disconnected" || peer.connectionState === "closed")) this.fail("Voice disconnected. Continue in text mode or start a new interview.");
      };
      stream.getTracks().forEach(track => {
        peer.addTrack(track, stream);
        track.onended = () => { if (!this.closed) this.fail("Microphone access ended. You can continue by typing."); };
      });
      const channel = peer.createDataChannel("oai-events");
      this.channel = channel;
      const opened = new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("Voice connection timed out. Please use text mode or try again.")), 20_000);
        const aborted = () => { clearTimeout(timer); reject(new DOMException("Stopped", "AbortError")); };
        this.abort.signal.addEventListener("abort", aborted, { once: true });
        channel.onopen = () => {
          clearTimeout(timer);
          this.abort.signal.removeEventListener("abort", aborted);
          resolve();
        };
      });
      // Attach a rejection handler while the SDP exchange is still in progress.
      void opened.catch(() => undefined);
      channel.onmessage = event => this.receive(event.data);
      channel.onerror = () => this.fail("The voice connection encountered an error. Text mode is still available.");
      channel.onclose = () => { if (!this.closed) this.fail("Voice disconnected. Text mode is still available."); };
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const answer = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST", body: offer.sdp,
        headers: { Authorization: `Bearer ${clientSecret}`, "Content-Type": "application/sdp" },
        signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(25_000)]),
      });
      if (!answer.ok) throw new Error("OpenAI could not establish the voice call. You can continue by typing.");
      const sdp = await answer.text();
      if (this.closed) return;
      await peer.setRemoteDescription({ type: "answer", sdp });
      await opened;
      if (!this.closed) this.callbacks.onStatus("Listening");
    } catch (error) {
      if (this.closed) return;
      const message = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "NotFoundError")
        ? "Microphone access is unavailable. Allow your microphone to use voice, or keep interviewing by text."
        : error instanceof Error ? error.message : "Voice could not connect. Text mode is available.";
      this.fail(message);
    }
  }

  // Realtime GA session.update: `session.type` is required; only instructions change.
  updateInstructions(instructions: string): void {
    this.send({ type: "session.update", session: { type: "realtime", instructions } });
  }

  sendText(text: string): void {
    if (this.channel?.readyState !== "open") throw new Error("Voice is still connecting. Please try again in a moment.");
    const id = `student_${crypto.randomUUID()}`;
    this.send({ type: "conversation.item.create", item: { id, type: "message", role: "user", content: [{ type: "input_text", text }] } });
    this.callbacks.onMessage("student", text, id);
    this.turnStarted = performance.now();
    this.send({ type: "response.create" });
    this.callbacks.onStatus("Thinking");
  }

  private send(event: object): void {
    if (this.channel?.readyState === "open") this.channel.send(JSON.stringify(event));
  }

  private receive(data: unknown): void {
    if (this.closed || typeof data !== "string") return;
    let event: Record<string, unknown>;
    try { event = JSON.parse(data) as Record<string, unknown>; } catch { return; }
    switch (event.type) {
      case "input_audio_buffer.speech_started":
        this.turnStarted = null;
        this.callbacks.onStatus("Listening");
        break;
      case "input_audio_buffer.speech_stopped":
        this.turnStarted = performance.now();
        this.callbacks.onStatus("Thinking");
        break;
      case "input_audio_buffer.committed":
        if (typeof event.item_id === "string") this.callbacks.onMessage("student", "", event.item_id);
        break;
      case "output_audio_buffer.started":
      case "response.output_audio.delta":
      case "response.audio.delta":
        if (this.turnStarted !== null) {
          this.callbacks.onLatency(performance.now() - this.turnStarted);
          this.turnStarted = null;
        }
        this.callbacks.onStatus("Patient speaking");
        this.outputPlaying = true;
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        this.outputPlaying = false;
        this.callbacks.onStatus("Listening");
        break;
      case "conversation.item.input_audio_transcription.completed":
        this.message("student", event.transcript, event.item_id);
        break;
      case "conversation.item.input_audio_transcription.failed":
        this.callbacks.onError("A spoken question could not be transcribed. The patient can still hear you; the transcript and guard may be incomplete.");
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done":
        this.message("patient", event.transcript, event.item_id);
        break;
      case "response.function_call_arguments.done": {
        if (typeof event.call_id !== "string" || this.handledCalls.has(event.call_id)) break;
        this.handledCalls.add(event.call_id);
        let ok = false;
        try {
          const args: unknown = typeof event.arguments === "string" ? JSON.parse(event.arguments) : null;
          if (event.name === "reveal_fact" && args && typeof args === "object" && "fact_id" in args && typeof args.fact_id === "string" && this.factIds.has(args.fact_id)) {
            this.callbacks.onFact(args.fact_id);
            ok = true;
          }
        } catch { /* Invalid tool arguments receive an explicit failure result. */ }
        this.send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ ok }) } });
        this.continueAfterTools = true;
        break;
      }
      case "response.done": {
        const response = event.response as { status?: string } | undefined;
        if (response?.status === "failed") this.callbacks.onError("The patient could not finish this response. Please try your question again.");
        if (this.continueAfterTools) {
          this.continueAfterTools = false;
          this.send({ type: "response.create" });
        } else if (!this.outputPlaying) {
          this.callbacks.onStatus("Listening");
        }
        break;
      }
      case "error":
        this.callbacks.onError("OpenAI could not process this turn. Wait for the patient to finish, then try again.");
        if (!this.outputPlaying) this.callbacks.onStatus("Listening");
        break;
    }
  }

  private message(role: "student" | "patient", text: unknown, itemId: unknown): void {
    if (typeof text !== "string" || !text.trim()) return;
    const id = typeof itemId === "string" ? itemId : crypto.randomUUID();
    if (this.seenMessages.has(id)) return;
    this.seenMessages.add(id);
    this.callbacks.onMessage(role, text, id);
  }

  private level(analyser: AnalyserNode, samples: Uint8Array<ArrayBuffer>): number {
    analyser.getByteTimeDomainData(samples);
    const power = samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / samples.length;
    return Math.min(1, Math.sqrt(power) * 5);
  }

  private watchOutput(stream: MediaStream): void {
    try {
      const context = this.context ?? new AudioContext();
      this.context = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      // Analysis only: playback stays on the audio element.
      context.createMediaStreamSource(stream).connect(analyser);
      this.outAnalyser = analyser;
    } catch { /* The orb still reacts to the microphone without output analysis. */ }
  }

  private meter(stream: MediaStream): void {
    try {
      const context = this.context ?? new AudioContext();
      this.context = context;
      void context.resume().catch(() => undefined);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const micSamples = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      const outSamples = new Uint8Array(new ArrayBuffer(256));
      let smoothMic = 0;
      let smoothOut = 0;
      const tick = () => {
        if (this.closed) return;
        smoothMic += (this.level(analyser, micSamples) - smoothMic) * 0.3;
        const out = this.outAnalyser && this.outputPlaying ? this.level(this.outAnalyser, outSamples) : 0;
        smoothOut += (out - smoothOut) * 0.3;
        this.callbacks.onLevel(smoothMic, smoothOut);
        this.frame = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* Voice remains usable when a browser cannot create the visual meter. */ }
  }

  private fail(message: string): void {
    this.close();
    this.callbacks.onError(message);
    this.callbacks.onDisconnect();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.abort.abort();
    cancelAnimationFrame(this.frame);
    this.channel?.close();
    this.peer?.close();
    this.stream?.getTracks().forEach(track => track.stop());
    this.audio.pause();
    this.audio.srcObject = null;
    if (this.context) void this.context.close().catch(() => undefined);
    this.callbacks.onLevel(0, 0);
  }
}
