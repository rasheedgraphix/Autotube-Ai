/**
 * Safe fetch helper that intercepts non-JSON responses (like HTML 404/502/503 from proxies)
 * and produces user-friendly error messages instead of "Unexpected token <, <!DOCTYPE... is not valid JSON".
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const text = await res.text();
      let friendlyMsg = `Server returned status ${res.status}`;
      if (res.status === 404) {
        friendlyMsg = "Backend API route not found (404). If using a static host, backend server is required.";
      } else if (res.status === 502 || res.status === 503 || res.status === 504) {
        friendlyMsg = "Server temporarily busy or waking up (503/504). Please try again in a few seconds.";
      } else if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        friendlyMsg = `Backend server responded with HTML error page (Status ${res.status}).`;
      } else if (text.trim()) {
        friendlyMsg = text.slice(0, 160);
      }
      return { ok: false, status: res.status, data: null, error: friendlyMsg };
    }

    const data = await res.json();
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : (data?.error || data?.message || `Request failed with status ${res.status}`) };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.message?.includes("<!DOCTYPE")
        ? "Server response was HTML instead of JSON. Server might be restarting, please retry."
        : err?.message || "Network error. Please check your internet connection.",
    };
  }
}
