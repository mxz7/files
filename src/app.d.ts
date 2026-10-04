// See https://kit.svelte.dev/docs/types#app

import type { Authed, Unauthed } from "#lib/types/auth.js";
import type { User } from "lucia";
import type { Logger } from "pino";

// for information about these interfaces
declare global {
  namespace App {
    interface Error {
      requestId?: string;
      errorId?: string;
    }
    interface Locals {
      validate: (useApi = true) => Promise<Authed | Unauthed>;
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
