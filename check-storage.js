// Diagnostic script to check Supabase Storage contents
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
  console.log('Checking Supabase Storage...\n');

  // List all files in the bucket
  const { data: files, error } = await supabase.storage
    .from('csv-files')
    .list('2f443678-b90b-4c50-bb2c-96ef2325779c', {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' }
    });

  if (error) {
    console.error('Error listing files:', error);
    return;
  }

  if (!files || files.length === 0) {
    console.log('⚠️  NO FILES FOUND IN STORAGE\n');
    console.log('This confirms that files are being deleted or never uploaded properly.');
    return;
  }

  console.log(`✓ Found ${files.length} files in storage:\n`);
  files.forEach(file => {
    console.log(`  ${file.name}`);
    console.log(`    Size: ${file.metadata?.size || 'unknown'} bytes`);
    console.log(`    Created: ${file.created_at || 'unknown'}`);
    console.log('');
  });
}

checkStorage().catch(console.error);
