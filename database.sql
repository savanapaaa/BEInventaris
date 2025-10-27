-- =============================================
-- DATABASE SISTEM PEMINJAMAN BARANG
-- =============================================

-- Create database
CREATE DATABASE IF NOT EXISTS inventaris_db;
USE inventaris_db;

-- Table: pengguna (users management)
CREATE TABLE pengguna (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nama_pengguna VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  kata_sandi VARCHAR(255) NOT NULL,
  peran ENUM('admin', 'pengguna') DEFAULT 'pengguna',
  dibuat_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  diperbarui_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: kategori (product categories)
CREATE TABLE kategori (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nama VARCHAR(100) NOT NULL UNIQUE,
  deskripsi TEXT,
  dibuat_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  diperbarui_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: produk (products with borrowing status)
CREATE TABLE produk (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nama VARCHAR(200) NOT NULL,
  deskripsi TEXT,
  kategori_id INT,
  jumlah_stok INT NOT NULL DEFAULT 1,
  stok_minimum INT NOT NULL DEFAULT 1,
  status_peminjaman ENUM('tersedia', 'dipinjam', 'maintenance') DEFAULT 'tersedia',
  dibuat_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  diperbarui_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (kategori_id) REFERENCES kategori(id) ON DELETE SET NULL,
  INDEX idx_status_peminjaman (status_peminjaman),
  INDEX idx_kategori (kategori_id)
);

-- Table: peminjaman (borrowing transactions)
CREATE TABLE peminjaman (
  id INT PRIMARY KEY AUTO_INCREMENT,
  produk_id INT NOT NULL,
  peminjam_id INT NOT NULL,
  petugas_id INT NOT NULL,
  tanggal_pinjam TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tanggal_kembali_rencana TIMESTAMP NOT NULL,
  tanggal_kembali_aktual TIMESTAMP NULL,
  status ENUM('dipinjam', 'dikembalikan', 'terlambat', 'hilang') DEFAULT 'dipinjam',
  keperluan TEXT,
  kondisi_pinjam TEXT DEFAULT 'Baik',
  kondisi_kembali TEXT NULL,
  denda DECIMAL(10,2) DEFAULT 0.00,
  catatan TEXT,
  dibuat_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  diperbarui_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (produk_id) REFERENCES produk(id) ON DELETE CASCADE,
  FOREIGN KEY (peminjam_id) REFERENCES pengguna(id) ON DELETE CASCADE,
  FOREIGN KEY (petugas_id) REFERENCES pengguna(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_tanggal_kembali (tanggal_kembali_rencana),
  INDEX idx_peminjam (peminjam_id),
  INDEX idx_produk (produk_id)
);

-- Table: perpanjangan (borrowing extensions)
CREATE TABLE perpanjangan (
  id INT PRIMARY KEY AUTO_INCREMENT,
  peminjaman_id INT NOT NULL,
  tanggal_kembali_lama TIMESTAMP NOT NULL,
  tanggal_kembali_baru TIMESTAMP NOT NULL,
  alasan TEXT,
  disetujui_oleh INT NOT NULL,
  dibuat_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (peminjaman_id) REFERENCES peminjaman(id) ON DELETE CASCADE,
  FOREIGN KEY (disetujui_oleh) REFERENCES pengguna(id) ON DELETE CASCADE
);

-- Table: riwayat (activity audit trail)
CREATE TABLE riwayat (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pengguna_id INT NOT NULL,
  tabel_terkait VARCHAR(50) NOT NULL,
  id_terkait INT NOT NULL,
  aksi ENUM('buat', 'ubah', 'hapus') NOT NULL,
  data_lama JSON,
  data_baru JSON,
  deskripsi TEXT,
  dibuat_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pengguna_id) REFERENCES pengguna(id) ON DELETE CASCADE,
  INDEX idx_tabel (tabel_terkait),
  INDEX idx_pengguna (pengguna_id),
  INDEX idx_tanggal (dibuat_pada)
);

-- =============================================
-- DATA SAMPLE
-- =============================================

-- Insert default admin user
-- Password: admin123 (hashed with bcrypt)
INSERT INTO pengguna (nama_pengguna, email, kata_sandi, peran) VALUES 
('Admin', 'admin@inventaris.com', '$2a$10$qMw2wnk.u4tySvoogf4mT.PGE3AMMb6Tv2MZtf/a5EVO6vblZ/TOe', 'admin'),
('John Doe', 'john@email.com', '$2a$10$qMw2wnk.u4tySvoogf4mT.PGE3AMMb6Tv2MZtf/a5EVO6vblZ/TOe', 'pengguna');

-- Insert sample categories
INSERT INTO kategori (nama, deskripsi) VALUES 
('Elektronik', 'Peralatan dan komponen elektronik'),
('Furniture', 'Mebel dan perabotan kantor'),
('Alat Tulis', 'Perlengkapan tulis menulis dan kantor'),
('Kendaraan', 'Kendaraan operasional'),
('Alat Olahraga', 'Peralatan dan perlengkapan olahraga');

-- Insert sample products (borrowable items)
INSERT INTO produk (nama, deskripsi, kategori_id, jumlah_stok, stok_minimum, status_peminjaman) VALUES 
('Laptop Dell Inspiron 15', 'Laptop untuk presentasi dan meeting', 1, 1, 1, 'tersedia'),
('Proyektor Epson EB-X06', 'Proyektor portable untuk presentasi', 1, 1, 1, 'tersedia'),
('Kamera Canon EOS 200D', 'Kamera DSLR untuk dokumentasi event', 1, 1, 1, 'dipinjam'),
('Meja Lipat Meeting', 'Meja lipat portable untuk meeting', 2, 1, 1, 'tersedia'),
('Kursi Roda Kantor', 'Kursi roda ergonomis', 2, 1, 1, 'maintenance'),
('Whiteboard Portable', 'Whiteboard kecil dengan stand', 3, 1, 1, 'tersedia'),
('Mobil Avanza B 1234 CD', 'Mobil operasional untuk dinas luar', 4, 1, 1, 'tersedia'),
('Motor Honda Beat', 'Motor untuk keperluan operasional', 4, 1, 1, 'dipinjam'),
('Bola Sepak FIFA Standard', 'Bola sepak resmi untuk olahraga', 5, 1, 1, 'tersedia'),
('Raket Badminton Yonex', 'Raket badminton professional', 5, 1, 1, 'tersedia');

-- Insert sample borrowing data
INSERT INTO peminjaman (produk_id, peminjam_id, petugas_id, tanggal_pinjam, tanggal_kembali_rencana, status, keperluan, kondisi_pinjam) VALUES 
(3, 2, 1, '2024-01-10', '2024-01-17', 'dipinjam', 'Dokumentasi event company gathering', 'Baik, lengkap dengan charger dan tas'),
(8, 2, 1, '2024-01-15', '2024-01-20', 'dipinjam', 'Antar dokumen ke client', 'Baik, bensin full'),
(1, 2, 1, '2024-01-05', '2024-01-10', 'dikembalikan', 'Presentasi proposal ke client ABC', 'Baik, lengkap dengan charger');

-- Update tanggal kembali aktual untuk yang sudah dikembalikan
UPDATE peminjaman SET 
  tanggal_kembali_aktual = '2024-01-09', 
  kondisi_kembali = 'Baik, tidak ada kerusakan' 
WHERE id = 3;

-- Insert sample extension data
INSERT INTO perpanjangan (peminjaman_id, tanggal_kembali_lama, tanggal_kembali_baru, alasan, disetujui_oleh) VALUES 
(1, '2024-01-15', '2024-01-17', 'Event diperpanjang 2 hari karena cuaca buruk', 1);

-- Insert sample history data
INSERT INTO riwayat (pengguna_id, tabel_terkait, id_terkait, aksi, data_lama, data_baru, deskripsi) VALUES 
(1, 'produk', 1, 'buat', NULL, '{"nama":"Laptop Dell Inspiron 15","kategori_id":1,"status":"tersedia"}', 'Menambah produk baru: Laptop Dell Inspiron 15'),
(1, 'produk', 2, 'buat', NULL, '{"nama":"Proyektor Epson EB-X06","kategori_id":1,"status":"tersedia"}', 'Menambah produk baru: Proyektor Epson EB-X06'),
(2, 'peminjaman', 1, 'buat', NULL, '{"produk_id":3,"status":"dipinjam","tanggal_kembali":"2024-01-17"}', 'Meminjam kamera Canon untuk dokumentasi event'),
(2, 'peminjaman', 2, 'buat', NULL, '{"produk_id":8,"status":"dipinjam","tanggal_kembali":"2024-01-20"}', 'Meminjam motor Honda Beat untuk antar dokumen'),
(2, 'peminjaman', 3, 'buat', NULL, '{"produk_id":1,"status":"dipinjam","tanggal_kembali":"2024-01-10"}', 'Meminjam laptop untuk presentasi client'),
(2, 'peminjaman', 3, 'ubah', '{"status":"dipinjam"}', '{"status":"dikembalikan","tanggal_kembali_aktual":"2024-01-09"}', 'Mengembalikan laptop dalam kondisi baik'),
(2, 'peminjaman', 1, 'ubah', '{"tanggal_kembali":"2024-01-15"}', '{"tanggal_kembali":"2024-01-17"}', 'Memperpanjang peminjaman kamera hingga 2024-01-17');

-- =============================================
-- VIEWS & STORED PROCEDURES
-- =============================================

-- View untuk peminjaman aktif
CREATE VIEW v_peminjaman_aktif AS
SELECT 
  p.id,
  pr.nama as nama_produk,
  pr.status_peminjaman,
  pm.nama_pengguna as nama_peminjam,
  pm.email as email_peminjam,
  pt.nama_pengguna as nama_petugas,
  p.tanggal_pinjam,
  p.tanggal_kembali_rencana,
  p.status,
  p.keperluan,
  DATEDIFF(CURDATE(), p.tanggal_kembali_rencana) as hari_terlambat
FROM peminjaman p
LEFT JOIN produk pr ON p.produk_id = pr.id
LEFT JOIN pengguna pm ON p.peminjam_id = pm.id  
LEFT JOIN pengguna pt ON p.petugas_id = pt.id
WHERE p.status IN ('dipinjam', 'terlambat');

-- View untuk statistik peminjaman
CREATE VIEW v_statistik_peminjaman AS
SELECT 
  COUNT(*) as total_peminjaman,
  SUM(CASE WHEN status = 'dipinjam' THEN 1 ELSE 0 END) as sedang_dipinjam,
  SUM(CASE WHEN status = 'dikembalikan' THEN 1 ELSE 0 END) as sudah_dikembalikan,
  SUM(CASE WHEN status = 'terlambat' THEN 1 ELSE 0 END) as terlambat,
  SUM(CASE WHEN status = 'hilang' THEN 1 ELSE 0 END) as hilang,
  SUM(denda) as total_denda
FROM peminjaman;

-- Stored procedure untuk update status terlambat
DELIMITER //
CREATE PROCEDURE UpdateStatusTerlambat()
BEGIN
  UPDATE peminjaman 
  SET status = 'terlambat' 
  WHERE status = 'dipinjam' 
  AND tanggal_kembali_rencana < CURDATE();
  
  SELECT ROW_COUNT() as updated_records;
END //
DELIMITER ;

-- Stored procedure untuk mendapatkan laporan bulanan
DELIMITER //
CREATE PROCEDURE LaporanBulanan(IN tahun INT, IN bulan INT)
BEGIN
  SELECT 
    pr.nama as nama_produk,
    k.nama as kategori,
    COUNT(p.id) as total_dipinjam,
    AVG(DATEDIFF(p.tanggal_kembali_aktual, p.tanggal_pinjam)) as rata_hari_pinjam,
    SUM(p.denda) as total_denda
  FROM peminjaman p
  LEFT JOIN produk pr ON p.produk_id = pr.id
  LEFT JOIN kategori k ON pr.kategori_id = k.id
  WHERE YEAR(p.tanggal_pinjam) = tahun 
  AND MONTH(p.tanggal_pinjam) = bulan
  GROUP BY pr.id, pr.nama, k.nama
  ORDER BY total_dipinjam DESC;
END //
DELIMITER ;

COMMIT;

-- =============================================
-- QUERY EXAMPLES
-- =============================================

-- Contoh query untuk cek produk tersedia:
-- SELECT * FROM produk WHERE status_peminjaman = 'tersedia';

-- Contoh query untuk cek peminjaman terlambat:
-- SELECT * FROM v_peminjaman_aktif WHERE hari_terlambat > 0;

-- Contoh query untuk statistik:
-- SELECT * FROM v_statistik_peminjaman;

-- Contoh menjalankan stored procedure:
-- CALL UpdateStatusTerlambat();
-- CALL LaporanBulanan(2024, 1);