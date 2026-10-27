import { apiClient } from '../../services/apiClient'
import { createLinkReviewService } from './createLinkReviewService'

export const linkReviewService = createLinkReviewService(apiClient)
export const { reviewLink, createManualLink } = linkReviewService
