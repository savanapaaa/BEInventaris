const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Helper function to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR'
  }).format(amount);
};

// Helper function to format date
const formatDate = (date) => {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(date));
};

// Get monthly report data
router.get('/bulanan', requireAdmin, async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    // Validate month and year
    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        error: 'Bulan harus antara 1-12'
      });
    }

    if (year < 2020 || year > new Date().getFullYear() + 1) {
      return res.status(400).json({
        success: false,
        error: 'Tahun tidak valid'
      });
    }

    // Get monthly statistics
    const [stats] = await db.execute(
      `SELECT 
        COUNT(*) as total_peminjaman,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as selesai,
        COUNT(CASE WHEN status = 'dipinjam' THEN 1 END) as aktif,
        COUNT(CASE WHEN status = 'terlambat' THEN 1 END) as terlambat,
        SUM(COALESCE(denda, 0)) as total_denda
       FROM peminjaman 
       WHERE MONTH(tanggal_pinjam) = ? AND YEAR(tanggal_pinjam) = ?`,
      [month, year]
    );

    // Get detailed borrowing data
    const [peminjaman] = await db.execute(
      `SELECT p.*, 
              pr.nama as nama_barang, 
              pr.kode as kode_barang,
              pm.nama_pengguna as nama_peminjam,
              pm.email as email_peminjam,
              k.nama as kategori_barang
       FROM peminjaman p 
       LEFT JOIN produk pr ON p.produk_id = pr.id 
       LEFT JOIN pengguna pm ON p.peminjam_id = pm.id 
       LEFT JOIN kategori k ON pr.kategori_id = k.id
       WHERE MONTH(p.tanggal_pinjam) = ? AND YEAR(p.tanggal_pinjam) = ?
       ORDER BY p.tanggal_pinjam DESC`,
      [month, year]
    );

    // Get top borrowed products
    const [topProducts] = await db.execute(
      `SELECT pr.nama, pr.kode, COUNT(*) as jumlah_dipinjam
       FROM peminjaman p 
       LEFT JOIN produk pr ON p.produk_id = pr.id 
       WHERE MONTH(p.tanggal_pinjam) = ? AND YEAR(p.tanggal_pinjam) = ?
       GROUP BY p.produk_id 
       ORDER BY jumlah_dipinjam DESC 
       LIMIT 10`,
      [month, year]
    );

    // Get borrowing by category
    const [byCategory] = await db.execute(
      `SELECT k.nama as kategori, COUNT(*) as jumlah
       FROM peminjaman p 
       LEFT JOIN produk pr ON p.produk_id = pr.id 
       LEFT JOIN kategori k ON pr.kategori_id = k.id
       WHERE MONTH(p.tanggal_pinjam) = ? AND YEAR(p.tanggal_pinjam) = ?
       GROUP BY k.id 
       ORDER BY jumlah DESC`,
      [month, year]
    );

    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    res.json({
      success: true,
      message: 'Data laporan bulanan berhasil diambil',
      data: {
        periode: {
          bulan: month,
          tahun: year,
          nama_bulan: monthNames[month - 1]
        },
        statistik: stats[0],
        peminjaman: peminjaman,
        produk_terpopuler: topProducts,
        berdasarkan_kategori: byCategory
      }
    });
  } catch (error) {
    console.error('Error getting monthly report:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal mengambil data laporan bulanan',
      details: error.message
    });
  }
});

// Generate PDF report
router.get('/generate-pdf', requireAdmin, async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    // Get report data (same as bulanan endpoint)
    const [stats] = await db.execute(
      `SELECT 
        COUNT(*) as total_peminjaman,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as selesai,
        COUNT(CASE WHEN status = 'dipinjam' THEN 1 END) as aktif,
        COUNT(CASE WHEN status = 'terlambat' THEN 1 END) as terlambat,
        SUM(COALESCE(denda, 0)) as total_denda
       FROM peminjaman 
       WHERE MONTH(tanggal_pinjam) = ? AND YEAR(tanggal_pinjam) = ?`,
      [month, year]
    );

    const [peminjaman] = await db.execute(
      `SELECT p.*, 
              pr.nama as nama_barang, 
              pr.kode as kode_barang,
              pm.nama_pengguna as nama_peminjam,
              k.nama as kategori_barang
       FROM peminjaman p 
       LEFT JOIN produk pr ON p.produk_id = pr.id 
       LEFT JOIN pengguna pm ON p.peminjam_id = pm.id 
       LEFT JOIN kategori k ON pr.kategori_id = k.id
       WHERE MONTH(p.tanggal_pinjam) = ? AND YEAR(p.tanggal_pinjam) = ?
       ORDER BY p.tanggal_pinjam DESC`,
      [month, year]
    );

    const [topProducts] = await db.execute(
      `SELECT pr.nama, pr.kode, COUNT(*) as jumlah_dipinjam
       FROM peminjaman p 
       LEFT JOIN produk pr ON p.produk_id = pr.id 
       WHERE MONTH(p.tanggal_pinjam) = ? AND YEAR(p.tanggal_pinjam) = ?
       GROUP BY p.produk_id 
       ORDER BY jumlah_dipinjam DESC 
       LIMIT 5`,
      [month, year]
    );

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    
    const filename = `laporan-inventaris-${monthNames[month-1]}-${year}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    // PDF Header
    doc.fontSize(20).text('LAPORAN INVENTARIS BULANAN', { align: 'center' });
    doc.fontSize(16).text(`${monthNames[month-1]} ${year}`, { align: 'center' });
    doc.moveDown(2);

    // Statistics Section
    doc.fontSize(14).text('RINGKASAN STATISTIK', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Total Peminjaman: ${stats[0].total_peminjaman}`);
    doc.text(`Peminjaman Selesai: ${stats[0].selesai}`);
    doc.text(`Peminjaman Aktif: ${stats[0].aktif}`);
    doc.text(`Peminjaman Terlambat: ${stats[0].terlambat}`);
    doc.text(`Total Denda: ${formatCurrency(stats[0].total_denda || 0)}`);
    doc.moveDown(2);

    // Top Products Section
    if (topProducts.length > 0) {
      doc.fontSize(14).text('BARANG PALING SERING DIPINJAM', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      topProducts.forEach((product, index) => {
        doc.text(`${index + 1}. ${product.nama} (${product.kode}) - ${product.jumlah_dipinjam} kali`);
      });
      doc.moveDown(2);
    }

    // Detailed Borrowing List
    if (peminjaman.length > 0) {
      doc.fontSize(14).text('DETAIL PEMINJAMAN', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);

      // Table headers
      let yPosition = doc.y;
      doc.text('Tanggal', 50, yPosition);
      doc.text('Peminjam', 120, yPosition);
      doc.text('Barang', 200, yPosition);
      doc.text('Status', 350, yPosition);
      doc.text('Denda', 420, yPosition);
      
      yPosition += 20;
      doc.moveTo(50, yPosition).lineTo(500, yPosition).stroke();
      yPosition += 10;

      // Table data
      peminjaman.forEach((item) => {
        if (yPosition > 700) { // New page if needed
          doc.addPage();
          yPosition = 50;
        }

        doc.text(formatDate(item.tanggal_pinjam), 50, yPosition);
        doc.text(item.nama_peminjam, 120, yPosition);
        doc.text(item.nama_barang, 200, yPosition);
        doc.text(item.status, 350, yPosition);
        doc.text(item.denda ? formatCurrency(item.denda) : '-', 420, yPosition);
        
        yPosition += 15;
      });
    }

    // Footer
    doc.fontSize(10).text(`Generated on ${formatDate(new Date())}`, { align: 'center' });
    
    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Gagal generate laporan PDF',
        details: error.message
      });
    }
  }
});

module.exports = router;