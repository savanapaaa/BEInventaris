-- =============================================
-- MIGRATION: UPDATE DATE FIELDS TO TIMESTAMP
-- Mengubah field tanggal peminjaman untuk include jam
-- =============================================

USE inventaris_db;

-- 1. Update table peminjaman: all date/datetime fields to TIMESTAMP
ALTER TABLE peminjaman 
MODIFY COLUMN tanggal_pinjam TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE peminjaman 
MODIFY COLUMN tanggal_kembali_rencana TIMESTAMP NOT NULL;

ALTER TABLE peminjaman 
MODIFY COLUMN tanggal_kembali_aktual TIMESTAMP NULL;

-- Additional timestamp fields in peminjaman
ALTER TABLE peminjaman 
MODIFY COLUMN tanggal_submit_return TIMESTAMP NULL;

ALTER TABLE peminjaman 
MODIFY COLUMN tanggal_konfirmasi TIMESTAMP NULL;

ALTER TABLE peminjaman 
MODIFY COLUMN tanggal_dikembalikan TIMESTAMP NULL;

-- 2. Update table perpanjangan: DATE -> TIMESTAMP  
ALTER TABLE perpanjangan
MODIFY COLUMN tanggal_kembali_lama TIMESTAMP NOT NULL;

ALTER TABLE perpanjangan
MODIFY COLUMN tanggal_kembali_baru TIMESTAMP NOT NULL;

-- 3. Verify changes
DESCRIBE peminjaman;
DESCRIBE perpanjangan;

-- 4. Sample data check (optional)
SELECT 
  id,
  tanggal_pinjam,
  tanggal_kembali_rencana,
  tanggal_kembali_aktual,
  status
FROM peminjaman 
LIMIT 5;