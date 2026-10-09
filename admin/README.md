# Rapi — Panel Admin

Panel terpisah untuk melihat seluruh pendaftar aplikasi `../app`. Memakai Bun dan PostgreSQL yang sama dengan aplikasi utama, tanpa dependensi npm tambahan.

## Menjalankan

Pastikan database aplikasi aktif dan aplikasi utama pernah dijalankan supaya tabel `users` sudah tersedia:

```bash
cd ../app
bun run db:up
bun run start
```

Di terminal lain, dari folder `admin`:

```bash
cp .env.example .env # hanya untuk setup pertama
bun run dev
```

Buka **http://localhost:3001**. Akun demo lokal: username **admin**, password **admin12345**. Ubah `ADMIN_USERNAME` dan `ADMIN_PASSWORD` di `.env` untuk mengganti akun; password minimal 8 karakter. Restart server setelah mengubah kredensial. Gunakan `bun run start` untuk menjalankan tanpa watch.

Script membaca `../app/.env` lalu `admin/.env` melalui flag `--env-file` Bun. `DATABASE_URL` mengikuti aplikasi utama; jika ingin menggantinya, tambahkan di `admin/.env`. `ADMIN_HOST` dan `ADMIN_PORT` terpisah dari host/port aplikasi utama. Tidak perlu database atau container baru. Server admin hanya membaca tabel `users`, tanpa membuat tabel atau mengubah data aplikasi. Jika tabel belum ada, jalankan aplikasi utama dahulu.

## Fitur

- Login admin sederhana, logout, dan sesi 8 jam dengan cookie HttpOnly / SameSite=Strict (Secure melalui HTTPS).
- Daftar semua pendaftar: ID, nama, email, tanggal daftar dalam WIB, urutan terbaru dahulu.
- Pencarian nama/email, total pendaftar, jumlah pendaftaran hari ini (Asia/Jakarta), dan muat ulang data.
- Tampilan responsif, pesan kosong, status pemuatan, dan pesan kesalahan.
- Endpoint data terlindungi; akun pengguna aplikasi biasa tidak memberi akses admin. Hash password tidak dikirim ke browser.

Sesi admin disimpan di memori proses; restart server (termasuk perubahan kode saat watch) mengharuskan login kembali. Lima percobaan login salah dalam satu menit membatasi login sementara per IP. Kredensial demo ini untuk penggunaan lokal; ganti sebelum dipakai di luar lingkungan lokal. Semua data dimuat sekaligus, lalu pencarian dilakukan di browser.

## Pengujian

```bash
bun run test
```

Pengujian membuat database sementara, menjalankan aplikasi utama, mendaftarkan dua akun melalui API aplikasi, dan memastikan keduanya muncul di panel. Pengujian juga memeriksa pembatasan akses, validasi login, rotasi sesi, logout, penolakan request lintas situs, pembatasan percobaan login, dan tidak adanya hash password dalam respons. Database sementara dihapus setelah selesai; database aplikasi tidak dimodifikasi. User database perlu hak `CREATE DATABASE`.

Struktur: `src/server.js` untuk server dan autentikasi, `public/` untuk UI, `tests/admin.test.js` untuk pengujian integrasi.

Referensi konfigurasi: [Bun environment variables](https://bun.com/docs/runtime/environment-variables).
