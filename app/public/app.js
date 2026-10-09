const $ = (selector) => document.querySelector(selector);
let todos = [];
let filter = "all";
let editingId = null;
let busy = false;
const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long" });
$("#today").textContent = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

async function api(path = "", options = {}) {
  const response = await fetch(`/api/todos${path}`, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
  return data;
}
function showError(error, target = "#error") {
  $(target).textContent = error.message || "Koneksi gagal. Periksa server lalu coba lagi.";
  $(target).hidden = false;
}
const icons = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/></svg>',
  delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>',
};
function render() {
  const completed = todos.filter((todo) => todo.completed).length;
  $("#total").textContent = todos.length;
  $("#completed").textContent = completed;
  $("#active").textContent = todos.length - completed;
  const visible = todos.filter((todo) => filter === "all" || todo.completed === (filter === "completed"));
  $("#list-count").textContent = `${visible.length} tugas`;
  $("#progress-label").textContent = todos.length ? `${completed} dari ${todos.length} tugas selesai${completed === todos.length ? '. Semua beres, selamat beristirahat!' : '. Setiap langkah berarti.'}` : "Mulai dari satu langkah kecil.";
  const list = $("#task-list");
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = '<div class="empty-icon" aria-hidden="true">✓</div><strong></strong><span></span>';
    empty.querySelector("strong").textContent = !todos.length ? "Hari baru, rencana baru." : filter === "completed" ? "Belum ada tugas yang selesai." : "Semua tugas sudah beres.";
    empty.querySelector("span").textContent = !todos.length ? "Tambahkan tugas pertamamu di atas." : filter === "completed" ? "Tandai tugas yang sudah kamu kerjakan." : "Nikmati waktu luangmu atau buat rencana baru.";
    list.append(empty);
  }
  for (const todo of visible) {
    const row = document.createElement("div");
    row.className = `task${todo.completed ? " done" : ""}`;
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "task-check";
    check.checked = todo.completed;
    check.disabled = busy;
    check.setAttribute("aria-label", `Tandai ${todo.title} ${todo.completed ? "belum selesai" : "selesai"}`);
    check.addEventListener("change", () => mutate(() => api(`/${todo.id}`, { method: "PATCH", body: JSON.stringify({ completed: check.checked }) })));
    const copy = document.createElement("div");
    copy.className = "task-copy";
    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = todo.title;
    const date = document.createElement("span");
    date.className = "task-date";
    date.textContent = `Ditambahkan ${dateFormat.format(new Date(todo.created_at))}`;
    copy.append(title, date);
    const actions = document.createElement("div");
    actions.className = "task-actions";
    for (const action of ["edit", "delete"]) {
      const button = document.createElement("button");
      button.className = `icon-button ${action}`;
      button.innerHTML = icons[action];
      button.disabled = busy;
      button.setAttribute("aria-label", `${action === "edit" ? "Edit" : "Hapus"} ${todo.title}`);
      button.title = action === "edit" ? "Edit tugas" : "Hapus tugas";
      button.onclick = () => {
        if (action === "edit") {
          editingId = todo.id;
          $("#edit-title").value = todo.title;
          $("#edit-error").hidden = true;
          $("#edit-dialog").showModal();
          $("#edit-title").focus();
        } else if (confirm(`Hapus tugas “${todo.title}”?`)) {
          mutate(() => api(`/${todo.id}`, { method: "DELETE" }));
        }
      };
      actions.append(button);
    }
    row.append(check, copy, actions);
    list.append(row);
  }
}
async function mutate(operation, afterSuccess = () => {}, errorTarget = "#error") {
  if (busy) return;
  busy = true;
  $("#error").hidden = true;
  $("#edit-error").hidden = true;
  $("#add-form button").disabled = true;
  $("#edit-form button[type=submit]").disabled = true;
  render();
  try {
    await operation();
    afterSuccess();
    todos = await api();
  } catch (error) {
    showError(error, $("#edit-dialog").open ? errorTarget : "#error");
  } finally {
    busy = false;
    $("#add-form button").disabled = false;
    $("#edit-form button[type=submit]").disabled = false;
    render();
  }
}
$("#add-form").onsubmit = (event) => {
  event.preventDefault();
  const title = $("#title").value.trim();
  if (!title) return showError(new Error("Nama tugas wajib diisi."));
  mutate(() => api("", { method: "POST", body: JSON.stringify({ title }) }), () => {
    $("#title").value = "";
    $("#title").focus();
  });
};
$("#edit-form").onsubmit = (event) => {
  event.preventDefault();
  const title = $("#edit-title").value.trim();
  if (!title) return showError(new Error("Nama tugas wajib diisi."), "#edit-error");
  mutate(() => api(`/${editingId}`, { method: "PATCH", body: JSON.stringify({ title }) }), () => $("#edit-dialog").close(), "#edit-error");
};
$("#cancel-edit").onclick = () => $("#edit-dialog").close();
document.querySelectorAll("[data-filter]").forEach((button) => {
  button.onclick = () => {
    filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => {
      item.classList.toggle("selected", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
    render();
  };
});
api().then((data) => { todos = data; render(); }).catch((error) => {
  render();
  showError(error);
});
