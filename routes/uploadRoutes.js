const express = require('express');
const router = express.Router();
const { handleProductImageUpload, deleteUploadedFile } = require('../middleware/uploadProductImage');
const auth = require('../middleware/auth');
const path = require('path');

// POST /upload/product-image - Upload single product image
router.post('/product-image', auth.authenticateToken, handleProductImageUpload, async (req, res) => {
  try {
    const uploadedFile = req.uploadedFile;
    
    // Log upload activity
    console.log(`📸 Image uploaded by user ${req.user.id}: ${uploadedFile.filename}`);
    
    // Return upload success response
    res.status(200).json({
      success: true,
      message: 'Gambar produk berhasil diupload',
      data: {
        filename: uploadedFile.filename,
        originalName: uploadedFile.originalname,
        size: uploadedFile.size,
        mimetype: uploadedFile.mimetype,
        url: uploadedFile.url,
        relativePath: uploadedFile.relativePath
      }
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    
    // If error occurs, delete the uploaded file
    if (req.uploadedFile && req.uploadedFile.filename) {
      deleteUploadedFile(req.uploadedFile.filename);
    }
    
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengupload gambar',
      error: error.message
    });
  }
});

// DELETE /upload/product-image/:filename - Delete uploaded image
router.delete('/product-image/:filename', auth.authenticateToken, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename format (security check)
    if (!filename.match(/^productimg_\d+-\d+\.(jpg|jpeg|png|gif|webp)$/i)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename format'
      });
    }
    
    const deleted = deleteUploadedFile(filename);
    
    if (deleted) {
      console.log(`🗑️ Image deleted by user ${req.user.id}: ${filename}`);
      res.json({
        success: true,
        message: 'Gambar berhasil dihapus'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File tidak ditemukan'
      });
    }
    
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menghapus gambar',
      error: error.message
    });
  }
});

// GET /upload/product-image/test - Test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Upload routes working',
    endpoints: [
      'POST /upload/product-image - Upload product image',
      'DELETE /upload/product-image/:filename - Delete product image',
      'GET /upload/test - This test endpoint'
    ],
    usage: {
      upload: {
        method: 'POST',
        url: '/upload/product-image',
        headers: {
          'Authorization': 'Bearer <token>',
          'Content-Type': 'multipart/form-data'
        },
        body: {
          productImage: 'file (max 5MB, JPG/PNG/GIF/WebP)'
        }
      }
    }
  });
});

module.exports = router;