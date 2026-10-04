// See https://kit.svelte.dev/docs/types#app

import type { Authed, Unauthed, User } from "#lib/types/auth.js";
import type { Logger } from "pino";

// for information about these interfaces
declare global {
  namespace App {
    interface Error {
      requestId?: string;
      errorId?: string;
    }
    interface Locals {
      validate: () => Promise<Authed | Unauthed>;
      auth: Authed | Unauthed;
      startTimer: number;
      logger: Logger;
      authedUser?: User;
      error?: string;
      errorId?: string;
      errorStackTrace?: string;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
