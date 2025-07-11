import { recordOptions } from "rrweb/typings/types";
import { eventWithTime } from "@rrweb/types";
import pako from "pako";

import { SessionReplay, SessionReplayOptions } from "./types";
import { Logger } from "../logger";

export class SessionReplayClient {
  private events: eventWithTime[] = [];
  private stopFn: (() => void) | null = null;
  private uploadTimer: NodeJS.Timeout | null = null;
  private isRecording = false;
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

    this.logger.debug("🚀 Initializing session recorder", options);

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

    const recordOptions: recordOptions<eventWithTime> = {
      emit: (event) => {
        this.events.push(event);
        this.logger.debug("💨 Event captured");

        if (this.events.length >= 100) {
          this._uploadEvents();
        }
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
    this._startUploadTimer();
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private handleVisibilityChange = () => {
    if (document.hidden) this._uploadEvents();
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

    if (this.events.length > 0) {
      this._uploadEvents();
    }
  }

  public clearEvents(): void {
    this.events = [];
  }

  private _startUploadTimer(): void {
    this.uploadTimer = setInterval(() => {
      if (this.events.length > 0) {
        this._uploadEvents();
      }
    }, this.options.flush_interval);
  }

  private async _uploadEvents(): Promise<void> {
    if (this.events.length === 0) return;

    this.logger.debug("💨 Uploading session events");

    const eventsToUpload = [...this.events];
    this.events = [];

    try {
      const payload = {
        sessionId: this.options.sessionId,
        projectKey: this.projectKey,
        timestamp: Date.now(),
        events: eventsToUpload,
      } as SessionReplay;
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
      this.events.unshift(...eventsToUpload); // Re-queue on failure
    }
  }
}
