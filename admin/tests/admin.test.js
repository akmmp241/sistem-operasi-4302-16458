import { afterAll, beforeAll, expect, test } from "bun:test";
import { SQL } from "bun";
const db = new SQL(process.env.DATABASE_URL);
const name = `rapi_admin_test_${process.pid}_${Date.now()}`;
let database, server, app, base, appBase, cookie, created = false;
const root = new URL("..", import.meta.url).pathname;
async function start(file, env, cwd) {
  const proc = Bun.spawn([process.execPath, file], { cwd, env: { ...process.env, ...env }, stdout: "pipe", stderr: "inherit" });
  const reader = proc.stdout.getReader();
  let output = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) throw new Error(`Server gagal dimulai: ${output}`);
    output += new TextDecoder().decode(value);
    const url = output.match(/http:\/\/[^\s]+/)?.[0];
    if (url) { reader.releaseLock(); return [proc, url]; }
  }
}
async function api(path, { method = "GET", body, session, origin } = {}) {
  const res = await fetch(`${base}${path}`, { method, headers: { ...(session ? { Cookie: session } : {}), ...(origin ? { Origin: origin } : {}), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json(), cookie: res.headers.get("set-cookie") };
}
beforeAll(async () => {
  await db.unsafe(`CREATE DATABASE "${name}"`);
  created = true;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  database = new SQL(url.toString());
  [app, appBase] = await start("src/server.js", { DATABASE_URL: url.toString(), PORT: "0" }, `${root}/../app`);
  for (const user of [{ name: "Pendaftar Pertama", email: "first@example.test" }, { name: "<script>alert(1)</script>", email: "second@example.test" }]) {
    const res = await fetch(`${appBase}api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...user, password: "password-uji-123" }) });
    expect(res.status).toBe(201);
  }
  [server, base] = await start("src/server.js", { DATABASE_URL: url.toString(), ADMIN_PORT: "0", ADMIN_USERNAME: "test-admin", ADMIN_PASSWORD: "test-password-123" }, root);
}, 15000);
afterAll(async () => {
  for (const proc of [server, app]) if (proc) { proc.kill(); await proc.exited; }
  if (database) await database.close();
  if (created) await db.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
  await db.close();
});
test("requires a separate admin session and hides secrets/static files", async () => {
  expect((await api("/api/users")).status).toBe(401);
  expect((await api("/api/auth/me")).status).toBe(401);
  expect((await api("/.env")).status).toBe(404);
  const userLogin = await fetch(`${appBase}api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "first@example.test", password: "password-uji-123" }) });
  expect((await api("/api/users", { session: userLogin.headers.get("set-cookie").split(";")[0] })).status).toBe(401);
});
test("validates login, lists all app registrants, and rotates sessions", async () => {
  expect((await api("/api/auth/login", { method: "POST", body: { username: "test-admin", password: "wrong" } })).status).toBe(401);
  expect((await api("/api/auth/login", { method: "POST", body: null })).status).toBe(400);
  const login = await api("/api/auth/login", { method: "POST", body: { username: "test-admin", password: "test-password-123" } });
  expect(login.status).toBe(200);
  expect(login.cookie).toContain("HttpOnly");
  expect(login.cookie).toContain("SameSite=Strict");
  cookie = login.cookie.split(";")[0];
  expect((await api("/api/auth/me", { session: cookie })).body.admin.username).toBe("test-admin");
  const result = await api("/api/users", { session: cookie });
  expect(result.status).toBe(200);
  expect(result.body.users.length).toBe(2);
  expect(result.body.users[0].email).toBe("second@example.test");
  expect(Object.keys(result.body.users[0]).sort()).toEqual(["created_at", "email", "id", "name"]);
  const relogin = await api("/api/auth/login", { method: "POST", session: cookie, body: { username: "test-admin", password: "test-password-123" } });
  expect((await api("/api/users", { session: cookie })).status).toBe(401);
  cookie = relogin.cookie.split(";")[0];
});
test("rejects cross-site writes and logout revokes access", async () => {
  expect((await api("/api/auth/logout", { method: "POST", session: cookie, origin: "https://other.example" })).status).toBe(403);
  const result = await api("/api/auth/logout", { method: "POST", session: cookie });
  expect(result.cookie).toContain("Max-Age=0");
  expect((await api("/api/users", { session: cookie })).status).toBe(401);
  expect((await database`SELECT COUNT(*)::int AS count FROM users`)[0].count).toBe(2);
});
test("limits repeated invalid logins", async () => {
  for (let i = 0; i < 5; i++) expect((await api("/api/auth/login", { method: "POST", body: { username: "bad", password: "bad" } })).status).toBe(401);
  expect((await api("/api/auth/login", { method: "POST", body: { username: "bad", password: "bad" } })).status).toBe(429);
});
