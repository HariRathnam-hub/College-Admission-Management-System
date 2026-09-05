import { Resend } from "resend";
import { env } from "@/config/env";

/** Singleton Resend client, reused across the app. */
export const resend = new Resend(env.RESEND_API_KEY);
