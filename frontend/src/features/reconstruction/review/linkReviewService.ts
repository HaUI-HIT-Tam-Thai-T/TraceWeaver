import { workspaceMutations } from "../../../services/workspaceMutations";
import { apiClient } from "../../../services/apiClient";
import { createLinkReviewService } from "./createLinkReviewService";
import type { LinkReviewService } from "./createLinkReviewService";

const raw = createLinkReviewService(apiClient);
export const linkReviewService: LinkReviewService = {
  ...raw,
  reviewLink: (workspaceId, runId, linkId, body, signal) =>
    workspaceMutations.afterMutation(workspaceId, () =>
      raw.reviewLink(workspaceId, runId, linkId, body, signal),
    ),
  createManualLink: (workspaceId, runId, body, signal) =>
    workspaceMutations.afterMutation(workspaceId, () =>
      raw.createManualLink(workspaceId, runId, body, signal),
    ),
};
export const { reviewLink, createManualLink } = linkReviewService;
