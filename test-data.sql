-- Test data untuk peminjaman
INSERT INTO peminjaman (produk_id, peminjam_id, petugas_id, tanggal_pinjam, tanggal_kembali_rencana, keperluan, kondisi_pinjam) 
VALUES 
(1, 2, 1, '2024-10-01', '2024-10-08', 'Keperluan penggunaan kantor', 'Baik'),
(2, 2, 1, '2024-10-02', '2024-10-09', 'Keperluan testing', 'Baik');

-- Update status produk
UPDATE produk SET status_peminjaman = 'dipinjam' WHERE id IN (1, 2);