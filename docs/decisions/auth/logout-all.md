# Decision Notes — Logout All Devices

**Status:** Accepted
**Domain:** Authentication

## Context

User membutuhkan fitur untuk mengakhiri seluruh session akun dari semua device sekaligus.

Project sudah memiliki:

sessionVersion
RefreshToken table
refresh-token rotation

## Decisions

- Endpoint wajib authenticated.
- Identity user diambil dari `req.auth.userId`.
- `sessionVersion++` digunakan untuk menginvalidasi seluruh access token lama.
- Semua refresh token aktif user direvoke.
- Current device ikut logout.
- Current auth cookies dihapus setelah transaction berhasil.
- `sessionVersion++` dan refresh-token revocation dilakukan dalam satu database transaction.
- Endpoint tidak membutuhkan request body.

## Why

`sessionVersion` dan refresh-token revocation menyelesaikan dua masalah berbeda:

sessionVersion++
→ mematikan access token lama

revoke refresh tokens
→ mencegah session lama melakukan refresh

Pendekatan ini memanfaatkan architecture yang sudah ada tanpa membutuhkan `sessionId` atau session-management system tambahan.

## Trade-off

**Pro**

implementasi sederhana
logout benar-benar berlaku ke semua device
cocok dengan architecture sekarang
mudah di-test

**Kontra**

current device juga ikut logout
user harus login kembali

Trade-off ini diterima karena memang tujuan fitur adalah mengakhiri seluruh session akun.

## Revisit When

Evaluasi ulang jika nanti project memiliki:

Active Devices
Logout Specific Device
Trusted Device
Session Management

Pada saat itu session dapat dikelola secara individual menggunakan stable `sessionId`.
