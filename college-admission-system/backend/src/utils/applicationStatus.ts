import { ApplicationStatus } from "@prisma/client";
import { AppError } from "@/middlewares/error.middleware";

/**
 * Allowed forward transitions for an application's lifecycle.
 *
 *   DRAFT --(student submits)--> SUBMITTED
 *   SUBMITTED --(admin)--> UNDER_REVIEW | REJECTED
 *   UNDER_REVIEW --(admin)--> APPROVED | REJECTED | WAITLISTED
 *   WAITLISTED --(admin)--> APPROVED | REJECTED
 *   APPROVED / REJECTED are terminal — no outgoing transitions.
 *
 * DRAFT -> SUBMITTED is only ever reached via applicationService.submitApplication
 * (a student action); everything else is only reached via
 * applicationReviewService.updateApplicationStatus (an admin action). Neither
 * service lets the caller skip this map.
 */
export const APPLICATION_STATUS_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: [ApplicationStatus.SUBMITTED],
  SUBMITTED: [ApplicationStatus.UNDER_REVIEW, ApplicationStatus.REJECTED],
  UNDER_REVIEW: [
    ApplicationStatus.APPROVED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WAITLISTED,
  ],
  WAITLISTED: [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED],
  APPROVED: [],
  REJECTED: [],
};

export const TERMINAL_DECISION_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.APPROVED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.WAITLISTED,
];

export function assertValidTransition(from: ApplicationStatus, to: ApplicationStatus): void {
  const allowed = APPLICATION_STATUS_TRANSITIONS[from];

  if (!allowed.includes(to)) {
    throw new AppError(
      `Cannot change application status from ${from} to ${to}. Allowed next state(s): ${
        allowed.length ? allowed.join(", ") : "none — this is a terminal status"
      }.`,
      409
    );
  }
}
