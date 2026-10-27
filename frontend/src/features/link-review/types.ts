import type { ApiError } from "../../services/apiError.ts";
import type { ReviewCreate, ManualLinkCreate } from "./schemas.ts";

export type LinkMutation = {
  status:
    | "idle"
    | "sending"
    | "success"
    | "uncertain"
    | "error"
    | "conflict"
    | "duplicate"
    | "locked";
  error: ApiError | null;
  linkId: string | null;
};
export const initialLinkMutation = (): LinkMutation => ({
  status: "idle",
  error: null,
  linkId: null,
});
export type LinkReviewActions = {
  reviewLink: (linkId: string, body: ReviewCreate) => Promise<void>;
  createManualLink: (body: ManualLinkCreate) => Promise<void>;
  probeClosedCase: () => void;
};
