const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// Get contact person for WhatsApp
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [contacts] = await db.execute(
      `SELECT nama, no_whatsapp, jabatan 
       FROM contact_person 
       WHERE aktif = TRUE 
       ORDER BY id ASC 
       LIMIT 5`
    );

    if (contacts.length === 0) {
      // Return default contact if none found in database
      return res.json({
        success: true,
        message: 'Data kontak berhasil diambil',
        data: [
          {
            nama: 'Admin Inventaris',
            no_whatsapp: '6281234567890',
            jabatan: 'Penanggung Jawab Inventaris'
          }
        ]
      });
    }

    res.json({
      success: true,
      message: 'Data kontak berhasil diambil',
      data: contacts
    });
  } catch (error) {
    console.error('Error getting contact person:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Gagal mengambil data kontak',
      details: error.message 
    });
  }
});

// Get primary contact (first active contact)
router.get('/primary', authenticateToken, async (req, res) => {
  try {
    const [contact] = await db.execute(
      `SELECT nama, no_whatsapp, jabatan 
       FROM contact_person 
       WHERE aktif = TRUE 
       ORDER BY id ASC 
       LIMIT 1`
    );

    if (contact.length === 0) {
      // Return default contact if none found
      return res.json({
        success: true,
        message: 'Data kontak utama berhasil diambil',
        data: {
          nama: 'Admin Inventaris',
          no_whatsapp: '6281234567890',
          jabatan: 'Penanggung Jawab Inventaris'
        }
      });
    }

    res.json({
      success: true,
      message: 'Data kontak utama berhasil diambil',
      data: contact[0]
    });
  } catch (error) {
    console.error('Error getting primary contact:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Gagal mengambil data kontak utama',
      details: error.message 
    });
  }
});

module.exports = router;