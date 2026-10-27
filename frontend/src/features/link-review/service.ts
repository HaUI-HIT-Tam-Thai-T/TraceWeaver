import { workspaceMutations } from '../../services/workspaceMutations';
import { apiClient } from "../../services/apiClient";
import { createLinkReviewService } from "./createLinkReviewService";

const raw = createLinkReviewService(apiClient);
export const linkReviewService = {
  ...raw,
  reviewLink: (...args: Parameters<typeof raw.reviewLink>) => workspaceMutations.afterMutation(args[0], () => raw.reviewLink(...args)),
  createManualLink: (...args: Parameters<typeof raw.createManualLink>) => workspaceMutations.afterMutation(args[0], () => raw.createManualLink(...args)),
};
export const { reviewLink, createManualLink } = linkReviewService;
