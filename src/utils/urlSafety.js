export function sanitizeAssetUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (raw.startsWith("//")) {
    return "";
  }

  if (raw.startsWith("/")) {
    return raw;
  }

  const allowedHosts = new Set();
  if (typeof window !== "undefined" && window.location?.host) {
    allowedHosts.add(window.location.host);
  }

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  if (supabaseUrl) {
    try {
      allowedHosts.add(new URL(supabaseUrl).host);
    } catch {
      // ignore malformed env value
    }
  }

  try {
    const parsed = new URL(raw);
    const isHttp = parsed.protocol === "https:" || parsed.protocol === "http:";
    const sameOrAllowedHost = allowedHosts.size === 0 || allowedHosts.has(parsed.host);
    if (isHttp && sameOrAllowedHost) {
      return parsed.toString();
    }
  } catch {
    return "";
  }

  return "";
}
