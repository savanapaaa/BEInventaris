-- Migration untuk menambah kolom foto bukti pengembalian
-- Tanggal: 26 Oktober 2025

USE inventaris_db;

-- Tambah kolom foto_bukti_pengembalian ke table peminjaman
ALTER TABLE peminjaman ADD COLUMN foto_bukti_pengembalian VARCHAR(255) AFTER catatan;

-- Update kondisi_kembali enum jika belum ada
ALTER TABLE peminjaman MODIFY COLUMN kondisi_kembali ENUM('Baik', 'Rusak Ringan', 'Rusak Berat', 'Hilang') NULL;

-- Tambah kolom catatan_pengembalian jika belum ada
ALTER TABLE peminjaman ADD COLUMN catatan_pengembalian TEXT AFTER kondisi_kembali;

-- Index untuk performa query foto
ALTER TABLE peminjaman ADD INDEX idx_foto_bukti (foto_bukti_pengembalian);

-- Tampilkan struktur table setelah migration
DESCRIBE peminjaman;