import { recordOptions } from "rrweb/typings/types";
import { eventWithTime, EventType, IncrementalSource } from "@rrweb/types";
import pako from "pako";
import { SessionReplay, SessionReplayOptions } from "./types";
import { Logger } from "../logger";

const MAX_BYTES_PER_PAYLOAD = 900_000;
const IDLE_TIMEOUT = 5 * 60 * 1000;

export class SessionReplayClient {
  private events: eventWithTime[] = [];
  private stopFn: (() => void) | null = null;
  private uploadTimer: NodeJS.Timeout | null = null;
  private isRecording = false;
  private isIdle = false;
  private lastActivity = Date.now();
  private hasSeenFullSnapshot = false;
  private logger: Logger;

  private options: Required<SessionReplayOptions> & {
    uploadUrl: string;
    sessionId: string;
    debug: boolean;
  };

  constructor(
    private projectKey: string,
    options: SessionReplayOptions & { sessionId: string; debug: boolean }
  ) {
    this.logger = new Logger(
      "[Onbored - Session Recorder]",
      options.debug ? "debug" : "info"
    );

    const uploadUrl = `${options.api_host.replace(
      /\/$/,
      ""
    )}/sessions?sessionId=${options.sessionId}`;

    this.options = {
      flush_interval: 10_000,
      mask_inputs: true,
      block_elements: [],
      on_error: (err: Error) =>
        console.error("[Onbored - Session Recorder]", err),
      ...options,
      uploadUrl,
    };
  }

  public async start(): Promise<void> {
    if (this.isRecording) {
      this.logger.info("🏃🏽‍♂️ Already recording");
      return;
    }

    const rrweb = await import("rrweb");
    this.isRecording = true;
    this.lastActivity = Date.now();
    this.hasSeenFullSnapshot = false;

    const recordOptions: recordOptions<eventWithTime> = {
      emit: (event) => {
        this.logger.debug("🧠 EMIT", {
          type: event.type,
          isFull: event.type === EventType.FullSnapshot,
        });
        this.events.push(event);
        this._checkIdle(event);
        this._maybeFlushSnapshot();

        if (event.type === EventType.FullSnapshot) {
          this.hasSeenFullSnapshot = true;
          this.logger.debug("📸 FullSnapshot captured");
          this._uploadEvents(); // flush immediately once we get it
        }

        this.logger.debug("💨 Event captured", { type: event.type });
      },
      blockSelector: this.options.block_elements.join(","),
      maskAllInputs: this.options.mask_inputs,
      maskInputOptions: {
        password: true,
        email: true,
        tel: true,
        number: true,
        text: true,
      },
      recordCanvas: false,
      sampling: {
        mousemove: true,
        mousemoveCallback: 50,
        input: "last",
      },
    };

    this.stopFn = rrweb.record(recordOptions) as (() => void) | null;

    // ⏱️ Fallback: if FullSnapshot hasn't been seen in 1s, force it
    setTimeout(() => {
      if (!this.hasSeenFullSnapshot) {
        this.logger.warn("⚠️ Forcing FullSnapshot (none seen yet)");
        (window as any).rrweb?.takeFullSnapshot?.();
      }
    }, 1000);

    this._startUploadTimer();
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this._uploadEvents();
    }
  };

  public stop(): void {
    if (!this.isRecording) return;

    this.logger.debug("🛑 Stopping session recording");
    this.isRecording = false;

    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );

    this.stopFn?.();
    this.stopFn = null;

    if (this.uploadTimer) {
      clearInterval(this.uploadTimer);
      this.uploadTimer = null;
    }

    this._uploadEvents(); // Final flush
  }

  public clearEvents(): void {
    this.events = [];
  }

  private _startUploadTimer(): void {
    this.uploadTimer = setInterval(() => {
      if (this.events.length > 0 && !this.isIdle) {
        this._uploadEvents();
      }
    }, this.options.flush_interval);
  }

  private _maybeFlushSnapshot(): void {
    const payloadSize = new Blob([JSON.stringify(this.events)]).size;
    if (payloadSize > MAX_BYTES_PER_PAYLOAD) {
      this.logger.debug("📦 Payload exceeded max size, flushing...");
      this._uploadEvents();
    }
  }

  private _checkIdle(event: eventWithTime) {
    const now = Date.now();

    const isInteractive =
      event.type === EventType.IncrementalSnapshot &&
      [
        IncrementalSource.MouseMove,
        IncrementalSource.MouseInteraction,
        IncrementalSource.Input,
        IncrementalSource.TouchMove,
        IncrementalSource.MediaInteraction,
        IncrementalSource.Drag,
        IncrementalSource.Scroll,
      ].includes(event.data?.source);

    if (isInteractive) {
      const wasIdle = this.isIdle;
      this.lastActivity = now;
      this.isIdle = false;

      if (wasIdle) {
        this.logger.debug("🟢 Resumed from idle");
        this._forceSnapshot();
      }
    } else if (now - this.lastActivity > IDLE_TIMEOUT) {
      this.isIdle = true;
      this.logger.debug("🟡 User is idle, pausing uploads");
    }
  }

  private _forceSnapshot() {
    if ((window as any).rrweb?.takeFullSnapshot) {
      (window as any).rrweb.takeFullSnapshot();
      this.logger.debug("📸 Forced full snapshot after idle resume");
    }
  }

  private async _uploadEvents(): Promise<void> {
    if (this.events.length === 0) return;

    const hasFullSnapshot = this.events.some(
      (e) => e.type === EventType.FullSnapshot
    );
    if (!hasFullSnapshot) {
      this.logger.warn("⚠️ No FullSnapshot found in event batch");
    }

    this.logger.debug("📤 Uploading session events", {
      count: this.events.length,
    });

    const eventsToUpload = [...this.events];
    this.events = [];

    try {
      const payload: SessionReplay = {
        sessionId: this.options.sessionId,
        projectKey: this.projectKey,
        timestamp: Date.now(),
        events: eventsToUpload,
      };
      const compressed = pako.gzip(JSON.stringify(payload));

      await fetch(this.options.uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Encoding": "gzip",
        },
        body: compressed,
      });
    } catch (error) {
      this.options.on_error?.(error as Error);
      this.events.unshift(...eventsToUpload); // Retry
    }
  }
}
