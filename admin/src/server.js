import { SQL } from "bun";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const { DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
if (!DATABASE_URL || !ADMIN_USERNAME || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
  throw new Error("Atur DATABASE_URL, ADMIN_USERNAME, dan ADMIN_PASSWORD (minimal 8 karakter). Lihat README.md.");
}
const db = new SQL(DATABASE_URL);
// Only read the app's existing users table; never create or migrate app data here.
await db`SELECT id, name, email, created_at FROM users LIMIT 0`;
const sessions = new Map();
const attempts = new Map();
const sessionAge = 8 * 60 * 60;
const digest = (value) => createHash("sha256").update(value).digest();
const keyOf = (token) => digest(token).toString("hex");
const equal = (a, b) => timingSafeEqual(digest(a), digest(b));
const tokenOf = (request) => request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith("rapi_admin_session="))?.slice(19) || "";
function cookie(request, token, age = sessionAge) {
  return `rapi_admin_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
function signedIn(request) {
  const token = tokenOf(request);
  return /^[a-f0-9]{64}$/.test(token) && (sessions.get(keyOf(token)) || 0) > Date.now();
}
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
const assets = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
};
const cleanup = setInterval(() => {
  for (const [key, expiry] of sessions) if (expiry <= Date.now()) sessions.delete(key);
  for (const [key, attempt] of attempts) if (attempt.until <= Date.now()) attempts.delete(key);
}, 60_000);
cleanup.unref();

const server = Bun.serve({
  hostname: process.env.ADMIN_HOST || "127.0.0.1",
  port: Number(process.env.ADMIN_PORT || 3001),
  maxRequestBodySize: 4096,
  async fetch(request, server) {
    const { pathname, origin } = new URL(request.url);
    const method = request.method;
    try {
      if (assets[pathname]) {
        if (!["GET", "HEAD"].includes(method)) return json({ error: "Metode tidak didukung." }, 405);
        const [file, type] = assets[pathname];
        return new Response(method === "HEAD" ? null : Bun.file(new URL(`../public/${file}`, import.meta.url)), {
          headers: { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
        });
      }
      if (pathname.startsWith("/api/") && !["GET", "HEAD"].includes(method)) {
        if ((request.headers.get("origin") && request.headers.get("origin") !== origin) || request.headers.get("sec-fetch-site") === "cross-site") {
          return json({ error: "Permintaan dari situs lain tidak diizinkan." }, 403);
        }
      }
      if (pathname === "/api/auth/login" && method === "POST") {
        const ip = server.requestIP(request)?.address || "local";
        const attempt = attempts.get(ip);
        if (attempt && attempt.until > Date.now() && attempt.count >= 5) return json({ error: "Terlalu banyak percobaan. Coba lagi dalam satu menit." }, 429, { "Retry-After": "60" });
        let body;
        try { body = await request.json(); } catch { return json({ error: "Data login tidak valid." }, 400); }
        if (!body || typeof body.username !== "string" || typeof body.password !== "string" || body.username.length > 100 || body.password.length > 128) return json({ error: "Isi username dan password yang valid." }, 400);
        const usernameOK = equal(body.username.trim(), ADMIN_USERNAME);
        const passwordOK = equal(body.password, ADMIN_PASSWORD);
        if (!usernameOK || !passwordOK) {
          attempts.set(ip, { count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1, until: attempt && attempt.until > Date.now() ? attempt.until : Date.now() + 60_000 });
          return json({ error: "Username atau password salah." }, 401);
        }
        attempts.delete(ip);
        sessions.delete(keyOf(tokenOf(request)));
        const token = randomBytes(32).toString("hex");
        sessions.set(keyOf(token), Date.now() + sessionAge * 1000);
        return json({ admin: { username: ADMIN_USERNAME } }, 200, { "Set-Cookie": cookie(request, token) });
      }
      if (pathname === "/api/auth/logout" && method === "POST") {
        sessions.delete(keyOf(tokenOf(request)));
        return json({ message: "Berhasil keluar." }, 200, { "Set-Cookie": cookie(request, "", 0) });
      }
      if (pathname === "/api/auth/me" && method === "GET") return signedIn(request) ? json({ admin: { username: ADMIN_USERNAME } }) : json({ error: "Silakan login sebagai admin." }, 401);
      if (pathname === "/api/users" && method === "GET") {
        if (!signedIn(request)) return json({ error: "Silakan login sebagai admin." }, 401);
        const users = await db`SELECT id, name, email, created_at FROM users ORDER BY created_at DESC, id DESC`;
        return json({ users });
      }
      return json({ error: "Halaman tidak ditemukan." }, 404);
    } catch (error) {
      console.error("Admin request failed:", error.code || error.name);
      return json({ error: "Data tidak dapat dimuat. Silakan coba lagi." }, 500);
    }
  },
});
console.log(`Panel admin berjalan di ${server.url}`);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, async () => {
  clearInterval(cleanup);
  await server.stop(true);
  await db.close();
  process.exit(0);
});
