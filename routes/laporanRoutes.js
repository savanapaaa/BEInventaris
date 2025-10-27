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

// Helper function to get report data based on type
async function getReportData(type = 'lengkap', originalType = type) {
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    // Base statistics - always needed
    const [overallStats] = await db.execute(`
      SELECT 
        (SELECT COUNT(*) FROM pengguna) as total_pengguna,
        (SELECT COUNT(*) FROM produk) as total_produk,
        (SELECT COUNT(*) FROM kategori) as total_kategori,
        (SELECT COUNT(*) FROM peminjaman) as total_peminjaman,
        (SELECT COUNT(*) FROM peminjaman WHERE status IN ('dipinjam', 'pending_return')) as aktif_peminjaman,
        (SELECT COUNT(*) FROM peminjaman WHERE status = 'dikembalikan') as selesai_peminjaman,
        (SELECT COUNT(*) FROM peminjaman WHERE status = 'pending_return') as pending_return,
        (SELECT COUNT(*) FROM peminjaman WHERE status IN ('dipinjam', 'pending_return') AND tanggal_kembali_rencana < CURDATE()) as terlambat,
        (SELECT SUM(COALESCE(denda, 0)) FROM peminjaman WHERE denda > 0) as total_denda
    `);

    const baseData = {
      metadata: {
        generated_at: new Date().toISOString(),
        generated_by: 'Admin',
        report_type: type,
        period: `${currentMonth}/${currentYear}`
      },
      overview: overallStats[0]
    };

    if (type === 'ringkasan' && originalType === 'ringkasan') {
      return baseData;
    }

    // Detailed data for other types
    let detailedData = { ...baseData };

    if (type === 'lengkap' || type === 'peminjaman') {
      // Peminjaman data
      const [peminjamanData] = await db.execute(`
        SELECT p.*, 
               pr.nama as nama_barang,
               pm.nama_pengguna as nama_peminjam,
               pm.email as email_peminjam,
               k.nama as kategori_barang,
               DATEDIFF(CURDATE(), p.tanggal_kembali_rencana) as hari_terlambat
        FROM peminjaman p 
        LEFT JOIN produk pr ON p.produk_id = pr.id 
        LEFT JOIN pengguna pm ON p.peminjam_id = pm.id 
        LEFT JOIN kategori k ON pr.kategori_id = k.id
        ORDER BY p.dibuat_pada DESC 
        LIMIT 50
      `);

      // Top borrowed items
      const [topBorrowed] = await db.execute(`
        SELECT pr.nama, pr.id, COUNT(*) as jumlah_dipinjam,
               k.nama as kategori
        FROM peminjaman p 
        LEFT JOIN produk pr ON p.produk_id = pr.id 
        LEFT JOIN kategori k ON pr.kategori_id = k.id
        GROUP BY p.produk_id 
        ORDER BY jumlah_dipinjam DESC 
        LIMIT 10
      `);

      // Borrowing by status
      const [statusBreakdown] = await db.execute(`
        SELECT status, COUNT(*) as jumlah,
               CASE 
                 WHEN status = 'dipinjam' THEN 'Sedang Dipinjam'
                 WHEN status = 'pending_return' THEN 'Menunggu Konfirmasi'
                 WHEN status = 'dikembalikan' THEN 'Sudah Dikembalikan'
                 WHEN status = 'terlambat' THEN 'Terlambat'
                 WHEN status = 'hilang' THEN 'Hilang'
                 ELSE status
               END as status_display
        FROM peminjaman 
        GROUP BY status
        ORDER BY jumlah DESC
      `);

      detailedData.peminjaman = {
        recent_transactions: peminjamanData,
        top_borrowed_items: topBorrowed,
        status_breakdown: statusBreakdown
      };
    }

    if (type === 'lengkap' || type === 'inventaris') {
      // Inventaris data
      const [produkData] = await db.execute(`
        SELECT p.*, k.nama as kategori_nama,
               CASE 
                 WHEN p.status_peminjaman = 'tersedia' THEN 'Tersedia'
                 WHEN p.status_peminjaman = 'dipinjam' THEN 'Sedang Dipinjam'
                 WHEN p.status_peminjaman = 'maintenance' THEN 'Maintenance'
                 ELSE p.status_peminjaman
               END as status_display
        FROM produk p 
        LEFT JOIN kategori k ON p.kategori_id = k.id 
        ORDER BY p.nama ASC
      `);

      // Low stock items
      const [lowStock] = await db.execute(`
        SELECT p.*, k.nama as kategori_nama
        FROM produk p 
        LEFT JOIN kategori k ON p.kategori_id = k.id 
        WHERE p.jumlah_stok <= p.stok_minimum 
        ORDER BY p.jumlah_stok ASC
      `);

      // Category breakdown
      const [categoryStats] = await db.execute(`
        SELECT k.nama as kategori, 
               COUNT(p.id) as jumlah_produk,
               SUM(p.jumlah_stok) as total_stok,
               SUM(CASE WHEN p.status_peminjaman = 'tersedia' THEN 1 ELSE 0 END) as tersedia,
               SUM(CASE WHEN p.status_peminjaman = 'dipinjam' THEN 1 ELSE 0 END) as dipinjam
        FROM kategori k 
        LEFT JOIN produk p ON k.id = p.kategori_id 
        GROUP BY k.id, k.nama
        ORDER BY jumlah_produk DESC
      `);

      detailedData.inventaris = {
        products: produkData,
        low_stock_items: lowStock,
        category_breakdown: categoryStats
      };
    }

    return detailedData;

  } catch (error) {
    console.error('❌ Error getting report data:', error);
    throw error;
  }
}

// GET /api/reports/preview - Preview data untuk cards
router.get('/preview', requireAdmin, async (req, res) => {
  try {
    let type = req.query.type || 'lengkap';
    let originalType = req.query.type; // Keep track of original type
    
    // Map frontend types to backend types for compatibility
    const typeMapping = {
      'summary': 'ringkasan',     // Frontend sends 'summary', backend uses 'ringkasan'
      'lengkap': 'lengkap',
      'ringkasan': 'ringkasan', 
      'peminjaman': 'peminjaman',
      'inventaris': 'inventaris'
    };
    
    // Apply mapping if exists
    if (typeMapping[type]) {
      type = typeMapping[type];
    }
    
    console.log(`📊 Generating preview for type: ${originalType} → mapped to: ${type}`);

    // Validate type
    const validTypes = ['lengkap', 'ringkasan', 'peminjaman', 'inventaris'];
    if (!validTypes.includes(type)) {
      console.log(`❌ Invalid type received: ${req.query.type} (mapped to: ${type})`);
      return res.status(400).json({
        success: false,
        error: 'Invalid report type. Valid types: lengkap, ringkasan, peminjaman, inventaris, summary'
      });
    }

    const reportData = await getReportData(type, originalType);

    res.json({
      success: true,
      message: `Preview laporan ${type} berhasil diambil`,
      type: type,
      data: reportData
    });

  } catch (error) {
    console.error('❌ Error generating preview:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Gagal mengambil preview laporan',
      details: error.message
    });
  }
});

// GET /api/reports/download - Download PDF laporan
router.get('/download', requireAdmin, async (req, res) => {
  try {
    let type = req.query.type || 'lengkap';
    let originalType = req.query.type; // Keep track of original type
    
    // Map frontend types to backend types for compatibility
    const typeMapping = {
      'summary': 'ringkasan',     // Frontend sends 'summary', backend uses 'ringkasan'
      'lengkap': 'lengkap',
      'ringkasan': 'ringkasan', 
      'peminjaman': 'peminjaman',
      'inventaris': 'inventaris'
    };
    
    // Apply mapping if exists
    if (typeMapping[type]) {
      type = typeMapping[type];
    }
    
    console.log(`📄 Generating PDF for type: ${originalType} → mapped to: ${type}`);

    // Validate type
    const validTypes = ['lengkap', 'ringkasan', 'peminjaman', 'inventaris'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report type. Valid types: lengkap, ringkasan, peminjaman, inventaris, summary'
      });
    }

    const reportData = await getReportData(type, originalType);

    // Create PDF
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4'
    });
    
    // Set response headers for PDF download
    const typeNames = {
      'lengkap': 'Lengkap',
      'ringkasan': 'Ringkasan',
      'peminjaman': 'Peminjaman',
      'inventaris': 'Inventaris'
    };
    
    const filename = `laporan-${type}-${new Date().getTime()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    // PDF Content
    generatePDFContent(doc, reportData, type, typeNames[type]);
    
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

// Helper function to generate PDF content
function generatePDFContent(doc, data, type, typeName) {
  // Header
  doc.fontSize(20).text('LAPORAN INVENTARIS', { align: 'center' });
  doc.fontSize(16).text(`Laporan ${typeName}`, { align: 'center' });
  doc.fontSize(12).text(`Generated: ${formatDate(new Date())}`, { align: 'center' });
  doc.moveDown(2);

  // Overview Statistics
  doc.fontSize(14).text('RINGKASAN STATISTIK', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11);
  
  const overview = data.overview;
  doc.text(`Total Pengguna: ${overview.total_pengguna}`);
  doc.text(`Total Produk: ${overview.total_produk}`);
  doc.text(`Total Kategori: ${overview.total_kategori}`);
  doc.text(`Total Peminjaman: ${overview.total_peminjaman}`);
  doc.text(`Peminjaman Aktif: ${overview.aktif_peminjaman}`);
  doc.text(`Peminjaman Selesai: ${overview.selesai_peminjaman}`);
  if (overview.pending_return > 0) {
    doc.text(`Menunggu Konfirmasi: ${overview.pending_return}`);
  }
  if (overview.terlambat > 0) {
    doc.text(`Terlambat: ${overview.terlambat}`);
  }
  if (overview.total_denda > 0) {
    doc.text(`Total Denda: ${formatCurrency(overview.total_denda)}`);
  }
  doc.moveDown(1.5);

  if (type === 'ringkasan') {
    // Footer
    doc.fontSize(10).text(`Laporan ${typeName} - ${formatDate(new Date())}`, { align: 'center' });
    return;
  }

  // Detailed sections based on type
  if ((type === 'lengkap' || type === 'peminjaman') && data.peminjaman) {
    // Top Borrowed Items
    if (data.peminjaman.top_borrowed_items.length > 0) {
      doc.fontSize(14).text('BARANG PALING SERING DIPINJAM', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      
      data.peminjaman.top_borrowed_items.slice(0, 8).forEach((item, index) => {
        doc.text(`${index + 1}. ${item.nama} (${item.kategori}) - ${item.jumlah_dipinjam} kali`);
      });
      doc.moveDown(1);
    }

    // Status Breakdown
    if (data.peminjaman.status_breakdown.length > 0) {
      doc.fontSize(14).text('BREAKDOWN STATUS PEMINJAMAN', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      
      data.peminjaman.status_breakdown.forEach(status => {
        doc.text(`${status.status_display}: ${status.jumlah} transaksi`);
      });
      doc.moveDown(1);
    }

    // Recent transactions (limited for PDF)
    if (data.peminjaman.recent_transactions.length > 0) {
      doc.fontSize(14).text('TRANSAKSI PEMINJAMAN TERBARU', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9);
      
      // Table headers
      let yPosition = doc.y;
      doc.text('Tanggal', 50, yPosition);
      doc.text('Peminjam', 120, yPosition);
      doc.text('Barang', 200, yPosition);
      doc.text('Status', 320, yPosition);
      doc.text('Jatuh Tempo', 420, yPosition);
      
      yPosition += 15;
      doc.moveTo(50, yPosition).lineTo(500, yPosition).stroke();
      yPosition += 5;

      // Table data (limit to prevent overflow)
      data.peminjaman.recent_transactions.slice(0, 15).forEach((item) => {
        if (yPosition > 700) { // New page if needed
          doc.addPage();
          yPosition = 50;
        }

        doc.text(formatDate(item.tanggal_pinjam), 50, yPosition);
        doc.text(item.nama_peminjam || '-', 120, yPosition);
        doc.text(item.nama_barang || '-', 200, yPosition);
        doc.text(item.status || '-', 320, yPosition);
        doc.text(formatDate(item.tanggal_kembali_rencana), 420, yPosition);
        
        yPosition += 12;
      });
      doc.moveDown(1);
    }
  }

  if ((type === 'lengkap' || type === 'inventaris') && data.inventaris) {
    // Add new page for inventaris section if we're doing lengkap
    if (type === 'lengkap') {
      doc.addPage();
    }

    // Low Stock Items
    if (data.inventaris.low_stock_items.length > 0) {
      doc.fontSize(14).text('BARANG STOK RENDAH', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      
      data.inventaris.low_stock_items.forEach((item) => {
        doc.text(`${item.nama} (${item.kategori_nama}) - Stok: ${item.jumlah_stok}, Min: ${item.stok_minimum}`);
      });
      doc.moveDown(1);
    }

    // Category Breakdown
    if (data.inventaris.category_breakdown.length > 0) {
      doc.fontSize(14).text('BREAKDOWN PER KATEGORI', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      
      data.inventaris.category_breakdown.forEach(cat => {
        if (cat.jumlah_produk > 0) {
          doc.text(`${cat.kategori}: ${cat.jumlah_produk} produk, Total stok: ${cat.total_stok}, Tersedia: ${cat.tersedia}, Dipinjam: ${cat.dipinjam}`);
        }
      });
      doc.moveDown(1);
    }
  }

  // Footer
  doc.fontSize(10).text(`Laporan ${typeName} - Generated on ${formatDate(new Date())}`, { align: 'center' });
}

module.exports = router;