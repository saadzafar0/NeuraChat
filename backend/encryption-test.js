/**
 * Encryption Test Script for Backend
 * 
 * Run this with: node encryption-test.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function runTests() {
  console.log('\n🔐 NeuraChat Backend Encryption Tests\n');
  console.log('='.repeat(60));
  
  // Test 1: Check if tables exist
  console.log('\n📊 Test 1: Database Tables\n');
  
  const tables = [
    'encryption_keys',
    'encryption_sessions',
    'used_prekeys',
    'key_rotation_logs',
    'group_sender_keys',
    'sender_key_distributions'
  ];
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`  ❌ ${table}: Table not found or error`);
        console.log(`     Error: ${error.message}`);
      } else {
        console.log(`  ✅ ${table}: Exists (${count || 0} rows)`);
      }
    } catch (error) {
      console.log(`  ❌ ${table}: Error - ${error.message}`);
    }
  }
  
  // Test 2: Check encryption_keys table
  console.log('\n🔑 Test 2: Encryption Keys\n');
  
  try {
    const { data, error } = await supabase
      .from('encryption_keys')
      .select('user_id, created_at, updated_at')
      .limit(5);
    
    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.log('  ⚠️  No encryption keys found in database');
      console.log('  💡 Keys should be created when users register');
    } else {
      console.log(`  ✅ Found ${data.length} encryption keys:`);
      data.forEach((row, i) => {
        console.log(`     ${i + 1}. User: ${row.user_id}`);
        console.log(`        Created: ${new Date(row.created_at).toLocaleString()}`);
      });
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
  
  // Test 3: Check encryption sessions
  console.log('\n🔄 Test 3: Encryption Sessions\n');
  
  try {
    const { data, error } = await supabase
      .from('encryption_sessions')
      .select('user_id, recipient_id, created_at')
      .limit(5);
    
    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.log('  ⚠️  No encryption sessions found');
      console.log('  💡 Sessions are created when first encrypted message is sent');
    } else {
      console.log(`  ✅ Found ${data.length} encryption sessions:`);
      data.forEach((row, i) => {
        console.log(`     ${i + 1}. ${row.user_id} ↔️ ${row.recipient_id}`);
        console.log(`        Created: ${new Date(row.created_at).toLocaleString()}`);
      });
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
  
  // Test 4: Check messages
  console.log('\n💬 Test 4: Messages\n');
  
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, sender_id, content, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
    } else if (!messages || messages.length === 0) {
      console.log('  ⚠️  No messages found');
    } else {
      console.log(`  ✅ Found ${messages.length} messages:`);
      messages.forEach((msg, i) => {
        const preview = msg.content.substring(0, 50);
        const isEncrypted = msg.content.length > 100 && msg.content.includes('{');
        console.log(`     ${i + 1}. ${isEncrypted ? '🔒' : '🔓'} From: ${msg.sender_id}`);
        console.log(`        Content: ${preview}${msg.content.length > 50 ? '...' : ''}`);
        console.log(`        Status: ${isEncrypted ? 'Appears encrypted' : 'Plain text'}`);
      });
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
  
  // Test 5: Check group sender keys
  console.log('\n👥 Test 5: Group Encryption Keys\n');
  
  try {
    const { data, error } = await supabase
      .from('group_sender_keys')
      .select('group_id, sender_id, key_id, created_at')
      .limit(5);
    
    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.log('  ⚠️  No group sender keys found');
      console.log('  💡 Keys are created when group encryption is initiated');
    } else {
      console.log(`  ✅ Found ${data.length} group sender keys:`);
      data.forEach((row, i) => {
        console.log(`     ${i + 1}. Group: ${row.group_id}`);
        console.log(`        Sender: ${row.sender_id}`);
        console.log(`        Key ID: ${row.key_id}`);
      });
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
  
  // Test 6: Check key rotation logs
  console.log('\n🔄 Test 6: Key Rotation Logs\n');
  
  try {
    const { data, error } = await supabase
      .from('key_rotation_logs')
      .select('user_id, rotation_reason, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.log('  ⚠️  No key rotation logs found');
      console.log('  💡 Logs are created when keys are rotated');
    } else {
      console.log(`  ✅ Found ${data.length} key rotation events:`);
      data.forEach((row, i) => {
        console.log(`     ${i + 1}. User: ${row.user_id}`);
        console.log(`        Reason: ${row.rotation_reason}`);
        console.log(`        Date: ${new Date(row.created_at).toLocaleString()}`);
      });
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 Summary\n');
  console.log('✅ = Working as expected');
  console.log('⚠️  = Table exists but no data (expected if no users registered)');
  console.log('❌ = Error or table missing\n');
  console.log('💡 Next Steps:');
  console.log('   1. Register a new user in the frontend');
  console.log('   2. Send an encrypted message');
  console.log('   3. Run this script again to verify data\n');
}

// Run tests
runTests().catch(console.error);
