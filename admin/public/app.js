const $ = (id) => document.getElementById(id);
let users = [];
let requestVersion = 0;
const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
function errorAt(id, message = "") { $(id).textContent = message; $(id).hidden = !message; }
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.error || "Permintaan gagal."), { status: response.status });
  return body;
}
function showLogin() {
  requestVersion++;
  users = [];
  $("rows").replaceChildren();
  $("dashboard").hidden = $("account").hidden = true;
  $("login").hidden = false;
  $("password").value = "";
}
function showDashboard(admin) {
  $("login").hidden = true;
  $("dashboard").hidden = $("account").hidden = false;
  $("username").textContent = admin.username;
  $("search").value = "";
  errorAt("login-error");
  loadUsers();
}
function render() {
  const query = $("search").value.trim().toLocaleLowerCase("id-ID");
  const filtered = users.filter(user => `${user.name} ${user.email}`.toLocaleLowerCase("id-ID").includes(query));
  $("total").textContent = users.length;
  $("today").textContent = users.filter(user => dayFormat.format(new Date(user.created_at)) === dayFormat.format(new Date())).length;
  $("shown").textContent = filtered.length;
  $("rows").replaceChildren(...filtered.map(user => {
    const row = document.createElement("tr");
    for (const value of [`#${user.id}`, user.name, user.email, dateFormat.format(new Date(user.created_at))]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  }));
  $("empty").hidden = filtered.length > 0;
  $("empty").textContent = users.length ? "Tidak ada pendaftar yang sesuai pencarian." : "Belum ada pendaftar. Akun baru akan muncul di sini.";
  $("count").textContent = `Menampilkan ${filtered.length} dari ${users.length} pendaftar`;
}
async function loadUsers() {
  const version = ++requestVersion;
  $("refresh").disabled = true;
  $("loading").hidden = false;
  errorAt("data-error");
  try {
    const result = await api("/api/users");
    if (version !== requestVersion) return;
    users = result.users;
    render();
    $("updated").textContent = `Diperbarui ${dateFormat.format(new Date())} WIB`;
  } catch (error) {
    if (version !== requestVersion) return;
    if (error.status === 401) { showLogin(); errorAt("login-error", "Sesi berakhir. Silakan masuk kembali."); }
    else errorAt("data-error", error.message);
  } finally {
    $("refresh").disabled = false;
    $("loading").hidden = true;
  }
}
$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.target.querySelector("button");
  button.disabled = true;
  errorAt("login-error");
  try {
    const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username: $("login-username").value, password: $("password").value }) });
    $("password").value = "";
    showDashboard(result.admin);
  } catch (error) { errorAt("login-error", error.message); }
  finally { button.disabled = false; }
});
$("logout").addEventListener("click", async () => {
  $("logout").disabled = true;
  try { await api("/api/auth/logout", { method: "POST" }); showLogin(); }
  catch (error) { errorAt("data-error", error.message); }
  finally { $("logout").disabled = false; }
});
$("refresh").addEventListener("click", loadUsers);
$("search").addEventListener("input", render);
try { showDashboard((await api("/api/auth/me")).admin); }
catch (error) { showLogin(); if (error.status !== 401) errorAt("login-error", "Server tidak dapat dihubungi. Coba muat ulang halaman."); }
finally { $("boot").hidden = true; }
