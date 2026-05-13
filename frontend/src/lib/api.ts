import { PUBLIC_API_URL } from "$env/static/public";

export const API_URL = (PUBLIC_API_URL as string) || "http://localhost:8787";
