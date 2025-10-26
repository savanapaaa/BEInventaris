-- Database Migration for Frontend Requirements
-- Add new columns to peminjaman table for photo return and admin confirmation

USE inventaris_db;

-- Add new columns to peminjaman table
ALTER TABLE peminjaman 
ADD COLUMN foto_pengembalian VARCHAR(255) NULL COMMENT 'Path to return photo',
ADD COLUMN tanggal_dikembalikan DATETIME NULL COMMENT 'Actual return date with time',
ADD COLUMN konfirmasi_admin ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'Admin confirmation status',
ADD COLUMN status_pengembalian ENUM('not_returned', 'returned_pending', 'returned_approved') DEFAULT 'not_returned' COMMENT 'Return status';

-- Update existing status enum to include new statuses
ALTER TABLE peminjaman 
MODIFY COLUMN status ENUM('dipinjam', 'dikembalikan', 'terlambat', 'hilang', 'completed', 'returned_pending', 'returned_approved') DEFAULT 'dipinjam';

-- Add indexes for better performance
ALTER TABLE peminjaman 
ADD INDEX idx_status_pengembalian (status_pengembalian),
ADD INDEX idx_konfirmasi_admin (konfirmasi_admin);

-- Create contact_person table for WhatsApp contact info
CREATE TABLE IF NOT EXISTS contact_person (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nama VARCHAR(100) NOT NULL,
    no_whatsapp VARCHAR(20) NOT NULL,
    jabatan VARCHAR(50) NOT NULL,
    aktif BOOLEAN DEFAULT TRUE,
    dibuat_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    diperbarui_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default contact person
INSERT INTO contact_person (nama, no_whatsapp, jabatan) VALUES
('Admin Inventaris', '6281234567890', 'Penanggung Jawab Inventaris'),
('Kepala Bagian', '6281234567891', 'Kepala Bagian Logistik');

-- Show the updated table structure
DESCRIBE peminjaman;
DESCRIBE contact_person;