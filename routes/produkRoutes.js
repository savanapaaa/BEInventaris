const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');
const { logActivity } = require('./riwayatRoutes');
// const { getImageUrl, deleteUploadedFile } = require('../middleware/uploadProductImage'); // Temporarily disabled

const router = express.Router();

// Get all products with pagination and search
router.get('/', async (req, res) => {
  try {
    const halaman = parseInt(req.query.halaman) || 1;
    const batas = parseInt(req.query.batas) || 10;
    const cari = req.query.cari || '';
    const kategoriId = req.query.kategori_id || '';
    const offset = (halaman - 1) * batas;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (cari) {
      whereClause += ' AND p.nama LIKE ?';
      queryParams.push(`%${cari}%`);
    }

    if (kategoriId) {
      whereClause += ' AND p.kategori_id = ?';
      queryParams.push(kategoriId);
    }

    // Get products with category name and borrowing status
    const [produk] = await db.execute(
      `SELECT p.*, k.nama as nama_kategori,
              CASE 
                WHEN p.status_peminjaman = 'tersedia' THEN 'Tersedia'
                WHEN p.status_peminjaman = 'dipinjam' THEN 'Sedang Dipinjam'
                WHEN p.status_peminjaman = 'maintenance' THEN 'Maintenance'
                ELSE 'Unknown'
              END as status_display
       FROM produk p 
       LEFT JOIN kategori k ON p.kategori_id = k.id 
       ${whereClause} 
       ORDER BY p.dibuat_pada DESC 
       LIMIT ? OFFSET ?`,
      [...queryParams, batas, offset]
    );

    // Add full image URLs to response with safer approach
    const produkWithImages = produk.map(item => {
      let gambar_url = null;
      try {
        if (item.gambar) {
          if (item.gambar.startsWith('http://') || item.gambar.startsWith('https://')) {
            gambar_url = item.gambar;
          } else if (item.gambar.startsWith('/uploads/')) {
            gambar_url = `${req.protocol}://${req.get('host')}${item.gambar}`;
          } else {
            gambar_url = `${req.protocol}://${req.get('host')}/uploads/products/${item.gambar}`;
          }
        }
      } catch (error) {
        console.error('Error processing image URL:', error);
        gambar_url = null;
      }
      
      return {
        ...item,
        gambar_url
      };
    });

    // Get total count
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM produk p ${whereClause}`,
      queryParams
    );

    const total = countResult[0].total;
    const totalHalaman = Math.ceil(total / batas);

    res.json({
      success: true,
      message: 'Data barang berhasil diambil',
      data: produkWithImages,
      pagination: {
        halaman,
        batas,
        total,
        totalHalaman
      }
    });
  } catch (error) {
    console.error('Get produk error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error saat mengambil data barang',
      details: error.message 
    });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const produkId = parseInt(req.params.id);
    
    const [produk] = await db.execute(
      `SELECT p.*, k.nama as nama_kategori,
              CASE 
                WHEN p.status_peminjaman = 'tersedia' THEN 'Tersedia'
                WHEN p.status_peminjaman = 'dipinjam' THEN 'Sedang Dipinjam'
                WHEN p.status_peminjaman = 'maintenance' THEN 'Maintenance'
                ELSE 'Unknown'
              END as status_display
       FROM produk p 
       LEFT JOIN kategori k ON p.kategori_id = k.id 
       WHERE p.id = ?`,
      [produkId]
    );

    if (produk.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Barang tidak ditemukan' 
      });
    }

    // Get current borrowing info if product is borrowed
    let peminjamInfo = null;
    if (produk[0].status_peminjaman === 'dipinjam') {
      const [peminjaman] = await db.execute(
        `SELECT pm.nama_pengguna as nama_peminjam, p.tanggal_kembali_rencana
         FROM peminjaman p 
         LEFT JOIN pengguna pm ON p.peminjam_id = pm.id
         WHERE p.produk_id = ? AND p.status = 'dipinjam'`,
        [produkId]
      );
      if (peminjaman.length > 0) {
        peminjamInfo = peminjaman[0];
      }
    }

    // Process image URL safely
    let gambar_url = null;
    try {
      if (produk[0].gambar) {
        if (produk[0].gambar.startsWith('http://') || produk[0].gambar.startsWith('https://')) {
          gambar_url = produk[0].gambar;
        } else if (produk[0].gambar.startsWith('/uploads/')) {
          gambar_url = `${req.protocol}://${req.get('host')}${produk[0].gambar}`;
        } else {
          gambar_url = `${req.protocol}://${req.get('host')}/uploads/products/${produk[0].gambar}`;
        }
      }
    } catch (error) {
      console.error('Error processing image URL:', error);
      gambar_url = null;
    }

    res.json({
      success: true,
      message: 'Barang berhasil diambil',
      data: {
        ...produk[0],
        gambar_url,
        info_peminjaman: peminjamInfo
      }
    });
  } catch (error) {
    console.error('Get produk error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error saat mengambil produk',
      details: error.message 
    });
  }
});

// Get available products for borrowing
router.get('/status/tersedia', authenticateToken, async (req, res) => {
  try {
    const kategoriId = req.query.kategori_id || '';
    const cari = req.query.cari || '';
    
    let whereClause = 'WHERE p.status_peminjaman = "tersedia"';
    let queryParams = [];

    if (cari) {
      whereClause += ' AND p.nama LIKE ?';
      queryParams.push(`%${cari}%`);
    }

    if (kategoriId) {
      whereClause += ' AND p.kategori_id = ?';
      queryParams.push(kategoriId);
    }

    const [produk] = await db.execute(
      `SELECT p.*, k.nama as nama_kategori
       FROM produk p 
       LEFT JOIN kategori k ON p.kategori_id = k.id 
       ${whereClause} 
       ORDER BY p.nama ASC`,
      queryParams
    );

    // Add image URLs with safe processing
    const produkWithImages = produk.map(item => {
      let gambar_url = null;
      try {
        if (item.gambar) {
          if (item.gambar.startsWith('http://') || item.gambar.startsWith('https://')) {
            gambar_url = item.gambar;
          } else if (item.gambar.startsWith('/uploads/')) {
            gambar_url = `${req.protocol}://${req.get('host')}${item.gambar}`;
          } else {
            gambar_url = `${req.protocol}://${req.get('host')}/uploads/products/${item.gambar}`;
          }
        }
      } catch (error) {
        console.error('Error processing image URL:', error);
        gambar_url = null;
      }
      
      return {
        ...item,
        gambar_url
      };
    });

    res.json({
      success: true,
      message: 'Produk tersedia berhasil diambil',
      data: produkWithImages
    });
  } catch (error) {
    console.error('Get available products error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error saat mengambil produk tersedia',
      details: error.message 
    });
  }
});

// Create new product
router.post('/', authenticateToken, [
  body('nama').notEmpty().withMessage('Nama produk diperlukan'),
  body('kategori_id').isInt({ min: 1 }).withMessage('Kategori ID harus berupa angka positif'),
  body('jumlah_stok').isInt({ min: 0 }).withMessage('Jumlah stok harus berupa angka positif'),
  body('stok_minimum').isInt({ min: 0 }).withMessage('Stok minimum harus berupa angka positif')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      nama, 
      deskripsi = '', 
      kategori_id, 
      jumlah_stok, 
      stok_minimum = 0,
      gambar = null
    } = req.body;

    // Check if product name already exists in same category
    const [existingProduk] = await db.execute(
      'SELECT id FROM produk WHERE nama = ? AND kategori_id = ?',
      [nama, kategori_id]
    );

    if (existingProduk.length > 0) {
      return res.status(400).json({ error: 'Produk dengan nama tersebut sudah ada dalam kategori ini' });
    }

    // Check if category exists
    const [kategori] = await db.execute(
      'SELECT id FROM kategori WHERE id = ?',
      [kategori_id]
    );

    if (kategori.length === 0) {
      return res.status(400).json({ error: 'Kategori tidak ditemukan' });
    }

    const [result] = await db.execute(
      `INSERT INTO produk 
       (nama, deskripsi, gambar, kategori_id, jumlah_stok, stok_minimum, dibuat_pada) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [nama, deskripsi, gambar, kategori_id, jumlah_stok, stok_minimum]
    );

    // Log activity
    await logActivity(
      req.user.userId,
      'produk',
      result.insertId,
      'buat',
      null,
      { nama, deskripsi, gambar, kategori_id, jumlah_stok, stok_minimum },
      `Membuat produk baru: ${nama}`
    );

    res.status(201).json({
      message: 'Barang berhasil dibuat',
      produkId: result.insertId
    });
  } catch (error) {
    console.error('Create produk error:', error);
    res.status(500).json({ error: 'Error saat membuat produk' });
  }
});

// Update product
router.put('/:id', authenticateToken, [
  body('nama').notEmpty().withMessage('Nama produk diperlukan'),
  body('kategori_id').isInt({ min: 1 }).withMessage('Kategori ID harus berupa angka positif'),
  body('jumlah_stok').isInt({ min: 0 }).withMessage('Jumlah stok harus berupa angka positif'),
  body('stok_minimum').isInt({ min: 0 }).withMessage('Stok minimum harus berupa angka positif')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        error: 'Data tidak valid',
        errors: errors.array() 
      });
    }

    const produkId = parseInt(req.params.id);
    const { nama, deskripsi, kategori_id, jumlah_stok, stok_minimum, gambar } = req.body;

    // Handle undefined parameters - ensure all have safe defaults
    const gambarValue = gambar !== undefined ? gambar : null;
    const deskripsiValue = deskripsi !== undefined ? deskripsi : null;
    const namaValue = nama || '';
    const kategoriIdValue = parseInt(kategori_id) || 0;
    const jumlahStokValue = parseInt(jumlah_stok) || 0;
    const stokMinimumValue = parseInt(stok_minimum) || 0;

    // Get current product data for comparison
    const [currentProduct] = await db.execute(
      'SELECT * FROM produk WHERE id = ?',
      [produkId]
    );

    if (currentProduct.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Barang tidak ditemukan' 
      });
    }

    const oldData = currentProduct[0];

    // Check if product name already exists in same category (excluding current product)
    const [duplicateProduk] = await db.execute(
      'SELECT id FROM produk WHERE nama = ? AND kategori_id = ? AND id != ?',
      [namaValue, kategoriIdValue, produkId]
    );

    if (duplicateProduk.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Produk dengan nama tersebut sudah ada dalam kategori ini' 
      });
    }

    // Check if category exists
    const [kategori] = await db.execute(
      'SELECT id FROM kategori WHERE id = ?',
      [kategoriIdValue]
    );

    if (kategori.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Kategori tidak ditemukan' 
      });
    }

    const [result] = await db.execute(
      `UPDATE produk 
       SET nama = ?, deskripsi = ?, gambar = ?, kategori_id = ?, 
           jumlah_stok = ?, stok_minimum = ?, diperbarui_pada = NOW() 
       WHERE id = ?`,
      [namaValue, deskripsiValue, gambarValue, kategoriIdValue, jumlahStokValue, stokMinimumValue, produkId]
    );

    // If image was changed and old image exists, delete old image file
    if (gambarValue !== oldData.gambar && oldData.gambar) {
      // TODO: Implement file deletion when upload middleware is re-enabled
      console.log('Image changed, old image should be deleted:', oldData.gambar);
    }

    // Log activity
    await logActivity(
      req.user.userId,
      'produk',
      produkId,
      'update',
      oldData,
      { nama: namaValue, deskripsi: deskripsiValue, gambar: gambarValue, kategori_id: kategoriIdValue, jumlah_stok: jumlahStokValue, stok_minimum: stokMinimumValue },
      `Mengupdate produk: ${namaValue}`
    );

    res.json({ 
      success: true,
      message: 'Barang berhasil diupdate',
      data: {
        id: produkId,
        nama: namaValue,
        deskripsi: deskripsiValue,
        gambar: gambarValue,
        kategori_id: kategoriIdValue,
        jumlah_stok: jumlahStokValue,
        stok_minimum: stokMinimumValue
      }
    });
  } catch (error) {
    console.error('Update produk error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error saat mengupdate produk' 
    });
  }
});

// Delete product
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const produkId = parseInt(req.params.id);

    // Get product data before deletion (to delete associated image)
    const [produk] = await db.execute('SELECT * FROM produk WHERE id = ?', [produkId]);
    
    if (produk.length === 0) {
      return res.status(404).json({ error: 'Barang tidak ditemukan' });
    }

    const [result] = await db.execute('DELETE FROM produk WHERE id = ?', [produkId]);

    // Delete associated image file if exists
    if (produk[0].gambar) {
      // TODO: Implement file deletion when upload middleware is re-enabled
      console.log('Product deleted, image should be deleted:', produk[0].gambar);
    }

    // Log activity
    await logActivity(
      req.user.userId,
      'produk',
      produkId,
      'hapus',
      produk[0],
      null,
      `Menghapus produk: ${produk[0].nama}`
    );

    res.json({ message: 'Barang berhasil dihapus' });
  } catch (error) {
    console.error('Delete produk error:', error);
    res.status(500).json({ error: 'Error saat menghapus produk' });
  }
});

// Get low stock products
router.get('/peringatan/stok-rendah', authenticateToken, async (req, res) => {
  try {
    const [produk] = await db.execute(
      `SELECT p.*, k.nama as nama_kategori 
       FROM produk p 
       LEFT JOIN kategori k ON p.kategori_id = k.id 
       WHERE p.jumlah_stok <= p.stok_minimum 
       ORDER BY p.jumlah_stok ASC`
    );

    // Add image URLs with safe processing
    const produkWithImages = produk.map(item => {
      let gambar_url = null;
      try {
        if (item.gambar) {
          if (item.gambar.startsWith('http://') || item.gambar.startsWith('https://')) {
            gambar_url = item.gambar;
          } else if (item.gambar.startsWith('/uploads/')) {
            gambar_url = `${req.protocol}://${req.get('host')}${item.gambar}`;
          } else {
            gambar_url = `${req.protocol}://${req.get('host')}/uploads/products/${item.gambar}`;
          }
        }
      } catch (error) {
        console.error('Error processing image URL:', error);
        gambar_url = null;
      }
      
      return {
        ...item,
        gambar_url
      };
    });

    res.json({
      message: 'Data barang dengan stok rendah berhasil diambil',
      data: produkWithImages
    });
  } catch (error) {
    console.error('Get stok rendah produk error:', error);
    res.status(500).json({ error: 'Error saat mengambil data barang stok rendah' });
  }
});

module.exports = router;