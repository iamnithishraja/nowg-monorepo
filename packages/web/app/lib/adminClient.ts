// Use local routes (same origin) - no external backend needed
const ADMIN_API_URL =
  typeof window !== "undefined" ? window.location.origin : "";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
  responseType?: "json" | "blob" | "text";
}

class AdminApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean>
  ): string {
    const url = endpoint.startsWith("/")
      ? `${this.baseUrl}${endpoint}`
      : `${this.baseUrl}/${endpoint}`;

    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      return `${url}?${searchParams.toString()}`;
    }

    return url;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { params, responseType = "json", ...fetchOptions } = options;
    const url = this.buildUrl(endpoint, params);

    const headers: Record<string, string> = {
      ...(fetchOptions.headers as Record<string, string>),
    };

    // Only add Content-Type for JSON requests
    if (responseType === "json" && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    // Note: For cross-origin requests (5173 -> 3000), cookies are automatically
    // sent by the browser with credentials: "include" IF they're set with
    // the correct SameSite and domain attributes. The backend CORS middleware
    // is configured to accept credentials from localhost:5173.

    const config: RequestInit = {
      ...fetchOptions,
      headers,
      credentials: "include", // Important for CORS with cookies
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        // Try to parse JSON error response first
        const contentType = response.headers.get("content-type");
        let errorData: any = null;
        
        try {
          if (contentType && contentType.includes("application/json")) {
            errorData = await response.json();
          } else {
            const errorText = await response.text().catch(() => response.statusText);
            // Try to parse as JSON even if content-type doesn't say so
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText, message: errorText };
            }
          }
        } catch {
          const errorText = await response.text().catch(() => response.statusText);
          errorData = { error: errorText, message: errorText };
        }
        
        // Create error with structured data
        const error = new Error(errorData?.message || errorData?.error || `Request failed with status ${response.status}`);
        (error as any).status = response.status;
        (error as any).data = errorData;
        throw error;
      }

      // Handle blob responses
      if (responseType === "blob") {
        return (await response.blob()) as T;
      }

      // Handle text responses
      if (responseType === "text") {
        return (await response.text()) as T;
      }

      // Handle JSON responses (default)
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      }

      return null as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Network error occurred");
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

// Export singleton instance
export const adminClient = new AdminApiClient(ADMIN_API_URL);

// Export for custom usage
export { AdminApiClient };
