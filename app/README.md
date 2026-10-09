# Rapi — Bun + PostgreSQL Todolist

Contoh web app sederhana: tambah, edit, tandai selesai, hapus (dengan konfirmasi), dan filter tugas. Data disimpan di PostgreSQL dan tetap ada setelah halaman atau server dimulai ulang.

## Menjalankan

Kebutuhan: Bun 1.4.2+, Docker dengan Compose, dan image `postgres:17-alpine` yang sudah tersedia lokal. Tidak ada dependensi npm yang perlu diinstal.

```bash
cp .env.example .env
bun run db:up
bun run dev
```

Buka **http://localhost:3000**. Untuk menjalankan tanpa watch, gunakan `bun run start`.

PostgreSQL berada di `127.0.0.1:5433`, dengan port host 5433 dan port container 5432. Compose memakai `pull_policy: never`, jadi hanya menggunakan image lokal. Container dan volume aplikasi terpisah dengan nama proyek `bun-todolist`. Tabel `todos` dibuat otomatis saat server dimulai.

Pengaturan ada di `.env`. Jika mengubah port, user, password, atau nama database, sesuaikan juga `DATABASE_URL`. Kredensial contoh ditujukan untuk demo lokal. Variabel inisialisasi PostgreSQL berlaku saat volume masih kosong.

```bash
# Hentikan database, pertahankan data di volume.
bun run db:down

# Jalankan kembali database beserta data yang sudah ada.
bun run db:up
```

Untuk menghentikan server, tekan `Ctrl+C` pada terminal server. `db:down` hanya menghentikan database.

## Struktur

- `src/server.js`: server Bun, API, dan inisialisasi tabel.
- `public/index.html`, `style.css`, `app.js`: antarmuka responsif tanpa framework.
- `compose.yaml`: PostgreSQL lokal dengan volume persisten dan healthcheck.
- `.env.example`: konfigurasi awal.

## API

| Metode | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/health` | Memeriksa koneksi PostgreSQL |
| GET | `/api/todos` | Daftar semua tugas |
| POST | `/api/todos` | Tambah tugas: `{"title":"Belajar sistem operasi"}` |
| PATCH | `/api/todos/:id` | Edit judul dan/atau status: `{"completed":true}` |
| DELETE | `/api/todos/:id` | Hapus tugas |

Judul wajib diisi, maksimal 255 karakter. API menggunakan query berparameter melalui `Bun.SQL`. Aplikasi ini merupakan demo lokal satu daftar bersama, tanpa akun/login. Font Google bersifat opsional; jika offline, tampilan memakai font sistem.

Referensi API runtime: [dokumentasi Bun SQL](https://bun.com/docs/runtime/sql) dan [Bun HTTP server](https://bun.com/docs/runtime/http/server).
