import type { I18nKey } from "@/lib/i18n/dictionaries";
import type { Booking } from "@/marketplace/schemas";

export type BookingStatus = Booking["status"];
export type PolicyId = Booking["cancellation_policy"];

export const STATUS_KEYS: Record<BookingStatus, I18nKey> = {
  pending_payment: "bk_status_pending_payment",
  confirmed: "bk_status_confirmed",
  cancelled: "bk_status_cancelled",
  completed: "bk_status_completed",
};

export const OUTCOME_KEYS: Record<BookingStatus, { title: I18nKey; text: I18nKey }> = {
  pending_payment: { title: "rsv_out_pending_payment_title", text: "rsv_out_pending_payment_text" },
  confirmed: { title: "rsv_out_confirmed_title", text: "rsv_out_confirmed_text" },
  cancelled: { title: "rsv_out_cancelled_title", text: "rsv_out_cancelled_text" },
  completed: { title: "rsv_out_completed_title", text: "rsv_out_completed_text" },
};

export const POLICY_KEYS: Record<PolicyId, { name: I18nKey; text: I18nKey }> = {
  flexible: { name: "bk_policy_flexible_name", text: "bk_policy_flexible_text" },
  moderate: { name: "bk_policy_moderate_name", text: "bk_policy_moderate_text" },
  strict: { name: "bk_policy_strict_name", text: "bk_policy_strict_text" },
};

export const STATUS_TONES: Record<BookingStatus, { background: string; color: string }> = {
  pending_payment: { background: "#FFF4DB", color: "#8A5A00" },
  confirmed: { background: "#EAF6D4", color: "#3F6212" },
  cancelled: { background: "#FEF2F2", color: "#B42318" },
  completed: { background: "#F4F1ED", color: "#6E6A66" },
};
