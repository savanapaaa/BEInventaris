const db = require('./config/database');

async function runMigration() {
  try {
    console.log('Starting database migration...');
    
    // Add foto_bukti_pengembalian column
    await db.execute(`
      ALTER TABLE peminjaman 
      ADD COLUMN IF NOT EXISTS foto_bukti_pengembalian VARCHAR(255) 
      AFTER catatan
    `);
    console.log('✓ Added foto_bukti_pengembalian column');
    
    // Add catatan_pengembalian column
    await db.execute(`
      ALTER TABLE peminjaman 
      ADD COLUMN IF NOT EXISTS catatan_pengembalian TEXT 
      AFTER kondisi_kembali
    `);
    console.log('✓ Added catatan_pengembalian column');
    
    // Show table structure
    const [columns] = await db.execute('DESCRIBE peminjaman');
    console.log('\nTable structure after migration:');
    console.table(columns);
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();