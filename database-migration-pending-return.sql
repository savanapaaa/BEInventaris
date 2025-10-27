-- =============================================
-- MIGRATION: Add pending_return status
-- =============================================

USE inventaris_db;

-- Backup current data before migration
CREATE TABLE IF NOT EXISTS peminjaman_backup AS SELECT * FROM peminjaman;

-- Add new status to ENUM
ALTER TABLE peminjaman 
MODIFY COLUMN status ENUM('dipinjam', 'dikembalikan', 'terlambat', 'hilang', 'pending_return') DEFAULT 'dipinjam';

-- Add new columns for return confirmation process
ALTER TABLE peminjaman 
ADD COLUMN foto_bukti_pengembalian VARCHAR(255) NULL AFTER catatan,
ADD COLUMN catatan_pengembalian TEXT NULL AFTER foto_bukti_pengembalian,
ADD COLUMN tanggal_submit_return TIMESTAMP NULL AFTER catatan_pengembalian,
ADD COLUMN dikonfirmasi_oleh INT NULL AFTER tanggal_submit_return,
ADD COLUMN tanggal_konfirmasi TIMESTAMP NULL AFTER dikonfirmasi_oleh;

-- Add foreign key for confirmation admin
ALTER TABLE peminjaman 
ADD CONSTRAINT fk_peminjaman_dikonfirmasi_oleh 
FOREIGN KEY (dikonfirmasi_oleh) REFERENCES pengguna(id) ON DELETE SET NULL;

-- Add index for performance
ALTER TABLE peminjaman 
ADD INDEX idx_status_pending (status),
ADD INDEX idx_dikonfirmasi_oleh (dikonfirmasi_oleh);

-- Update status descriptions for clarity
-- dipinjam: Sedang dipinjam
-- pending_return: Menunggu konfirmasi pengembalian dari admin  
-- dikembalikan: Sudah dikembalikan dan dikonfirmasi admin
-- terlambat: Terlambat dikembalikan
-- hilang: Barang hilang

COMMIT;

-- Check migration result
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'inventaris_db' 
AND TABLE_NAME = 'peminjaman' 
AND COLUMN_NAME IN ('status', 'foto_bukti_pengembalian', 'catatan_pengembalian', 'tanggal_submit_return', 'dikonfirmasi_oleh', 'tanggal_konfirmasi');

-- Sample data check
SELECT status, COUNT(*) as count FROM peminjaman GROUP BY status;