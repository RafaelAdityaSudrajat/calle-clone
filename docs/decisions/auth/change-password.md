# Decision Notes — Change Password

**Status:** Accepted
**Domain:** Authentication

## Context

User yang sudah login perlu bisa mengganti password secara aman.

Business rules mewajibkan:

currentPassword + newPassword

dan setelah berhasil, session lain harus diinvalidasi.

## Decisions

- Change Password wajib authenticated.
- Identity user diambil dari `req.auth.userId`, bukan dari body.
- `currentPassword` wajib diverifikasi dengan `bcrypt.compare()`.
- `newPassword` harus mengikuti password policy backend.
- Wrong current password menggunakan `400`, bukan `401`, agar tidak memicu silent refresh frontend.
- Setelah sukses, semua session termasuk current device di-logout.
- `sessionVersion++` digunakan untuk mematikan access token lama.
- Semua refresh token aktif direvoke.
- Pending reset-password token ikut diinvalidasi.
- Password update + session invalidation dilakukan dalam satu database transaction.
- `bcrypt.hash(newPassword)` dilakukan sebelum transaction.
- Conditional update digunakan untuk mencegah concurrent password change menghasilkan last-write-wins.

## Why

Pendekatan ini dipilih karena project sudah memiliki:

sessionVersion
RefreshToken table
refresh-token rotation

Jadi logout seluruh session bisa dilakukan dengan sederhana tanpa menambah `sessionId` atau session-management architecture baru.

## Trade-off

**Pro**

lebih sederhana
security kuat
mudah di-test
cocok dengan architecture sekarang

**Kontra**

current device ikut logout
user harus login kembali

Trade-off ini diterima untuk versi project saat ini.

## Revisit When

Evaluasi ulang jika nanti ada feature:

Active Devices
Logout Specific Device
Trusted Device
Keep Current Session
Session Management

Pada saat itu architecture bisa berkembang ke per-session identity seperti `sessionId`.
