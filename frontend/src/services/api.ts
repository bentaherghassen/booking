import axios from 'axios';

export interface ClientRequestData {
  client_name: string;
  company_name?: string;
  email: string;
  project_type: string;
  description: string;
  budget_range?: string;
}

export interface QuoteResponse {
  success: boolean;
  reference_id: string;
  client_name: string;
  company_name?: string;
  email: string;
  project_type: string;
  description: string;
  budget_range: string;
  ai_estimated_price: number | string;
  formatted_price: string;
  estimated_timeline: string;
  pdf_url?: string;
  booking_url?: string;
  created_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

/**
 * Submits client details to the Django backend endpoint (/api/submit-request/).
 * @param formData ClientRequestData object containing request details
 * @returns Promise<QuoteResponse> Response from backend including generated quote & reference ID
 */
export const submitClientRequest = async (formData: ClientRequestData): Promise<QuoteResponse> => {
  try {
    const response = await apiClient.post<QuoteResponse>('/submit-request/', formData);
    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 429) {
        const errorMsg = error.response.data?.detail || error.response.data?.error || 'Rate limit exceeded. Maximum 5 requests allowed per hour. Please try again later.';
        throw new Error(errorMsg);
      }
      if (error.response.status === 400 && error.response.data) {
        const errors = error.response.data;
        if (typeof errors === 'object') {
          const firstKey = Object.keys(errors)[0];
          const val = errors[firstKey];
          const msg = Array.isArray(val) ? val[0] : val;
          throw new Error(`${firstKey}: ${msg}`);
        }
      }
      throw new Error(error.response.data?.message || error.response.data?.error || `Server error: ${error.response.status}`);
    }
    throw new Error(error.message || 'Network error while submitting request');
  }
};

export default apiClient;
