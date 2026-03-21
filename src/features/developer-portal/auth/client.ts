import axios from "axios";
import { getDeveloperAccessToken } from "@/features/developer-portal/auth/token";

export const developerHttpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
});

developerHttpClient.interceptors.request.use((config) => {
  const token = getDeveloperAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
