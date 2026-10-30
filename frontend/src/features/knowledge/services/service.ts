import { apiClient } from "../../../services/apiClient";
import { createKnowledgeService } from "./createKnowledgeService";
export const knowledgeService = createKnowledgeService(apiClient);
