-- Database Migration Script: Add Image Support to Products
-- Date: 2025-10-25
-- Purpose: Add gambar column to produk table for image upload functionality

-- Use the correct database (adjust name as needed)
USE inventaris;

-- 1. Add gambar column to produk table
ALTER TABLE produk 
ADD COLUMN gambar VARCHAR(500) NULL 
COMMENT 'URL or path to product image' 
AFTER deskripsi;

-- 2. Add index for better performance (optional)
ALTER TABLE produk 
ADD INDEX idx_produk_gambar (gambar);

-- 3. Update existing records with placeholder images (optional)
-- This gives existing products a default placeholder image
UPDATE produk 
SET gambar = CONCAT('https://via.placeholder.com/300x200/4A90E2/FFFFFF?text=', 
                   REPLACE(REPLACE(nama_produk, ' ', '+'), '&', '%26'))
WHERE gambar IS NULL;

-- 4. Verify the migration
DESCRIBE produk;

-- 5. Show sample data to confirm changes
SELECT id, nama_produk, gambar, status 
FROM produk 
LIMIT 5;

-- 6. Optional: Create uploads directory structure (for file system storage)
-- This would be handled by the backend application, not SQL

-- Migration Complete
SELECT 'Database migration completed successfully!' as status;