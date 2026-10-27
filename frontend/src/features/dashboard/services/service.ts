import { apiClient } from '../../../services/apiClient';
import { createDashboardService } from './createDashboardService';
export const dashboardService = createDashboardService(apiClient);
