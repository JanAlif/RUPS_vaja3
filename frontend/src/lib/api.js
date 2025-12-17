const BASE = (import.meta.env.VITE_API_URL || "http://localhost:5050").replace(/\/+$/, "");

async function request(path, options = {}) {
  const url = path.startsWith("/") ? `${BASE}${path}` : `${BASE}/${path}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const isJSON = res.headers.get("content-type")?.includes("application/json");
  const data = isJSON ? await res.json() : await res.text();
  if (!res.ok) {
    const message = (isJSON && data?.message) || res.statusText || "Request failed";
    throw new Error(message);
  }
  return data;
}

export const api = {
  register: (body) => request("/api/users", { method: "POST", body: JSON.stringify(body) }),
  login:    (body) => request("/api/users/login", { method: "POST", body: JSON.stringify(body) }),
  logout:   ()     => request("/api/users/logout", { method: "POST" }),
  verifySession: () => request("/api/users/me", { method: "GET" }),
  quiz:     (body) => request("/api/quiz", { method: "POST", body: JSON.stringify(body) }),
};
