/**
 * Test email confirmation flow for all 3 user types
 * Run: node tmp/verify-email-confirmation.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pniwewlldopizfwrvneo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaXdld2xsZG9waXpmd3J2bmVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMDMzODQsImV4cCI6MjA5MDU3OTM4NH0.k9owHD485n0uRwGylCdvywPxC5Bi6woaPVDVaudRLUY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TS = Date.now();
const REDIRECT = 'https://www.ipiz-giva.com/login';

const testUsers = [
  {
    label: 'visitante (external)',
    email: `claudioafonsohenriques8+qa.visitante.${TS}@gmail.com`,
    password: 'QAtest@2026!',
    metadata: { user_type: 'external', full_name: 'QA Visitante Test' },
  },
  {
    label: 'empresa (company)',
    email: `claudioafonsohenriques8+qa.empresa.${TS}@gmail.com`,
    password: 'QAtest@2026!',
    metadata: {
      user_type: 'company',
      full_name: 'QA Empresa Test',
      company_name: 'QA Corp Ltda',
      nif: '999888777',
    },
  },
  {
    label: 'aluno (student)',
    email: `claudioafonsohenriques8+qa.aluno.${TS}@gmail.com`,
    password: 'QAtest@2026!',
    metadata: {
      user_type: 'student',
      full_name: 'QA Aluno Test',
      process_number: `QA-${TS}`,
      course: 'QA Course',
    },
  },
];

async function testSignup(user) {
  console.log(`\n--- Testing: ${user.label} ---`);
  console.log(`Email: ${user.email}`);

  const { data, error } = await supabase.auth.signUp({
    email: user.email,
    password: user.password,
    options: {
      emailRedirectTo: REDIRECT,
      data: user.metadata,
    },
  });

  if (error) {
    console.log(`❌ SIGNUP_ERROR: ${error.message}`);
    console.log(`   SIGNUP_ERROR_CODE: ${error.code ?? 'n/a'}`);
    console.log(`   SIGNUP_ERROR_STATUS: ${error.status ?? 'n/a'}`);
    return false;
  }

  const session = data.session;
  const emailConfirmedAt = data.user?.email_confirmed_at;

  if (session) {
    console.log(`⚠️  WARNING: Got session immediately - email confirmation may be DISABLED`);
  } else {
    console.log(`✅ No immediate session - email confirmation is REQUIRED`);
  }

  if (emailConfirmedAt) {
    console.log(`⚠️  email_confirmed_at set: ${emailConfirmedAt} (may be pre-confirmed)`);
  } else {
    console.log(`✅ email_confirmed_at is null - confirmation pending`);
  }

  console.log(`   user.id: ${data.user?.id}`);
  console.log(`   identities: ${JSON.stringify(data.user?.identities?.map(i => i.provider))}`);

  // Attempt login before confirming - should be blocked
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (loginError) {
    if (loginError.message.toLowerCase().includes('confirm') || loginError.code === 'email_not_confirmed') {
      console.log(`✅ Login blocked: ${loginError.message}`);
    } else {
      console.log(`⚠️  Login failed (unexpected reason): ${loginError.message} [${loginError.code}]`);
    }
  } else if (loginData.session) {
    console.log(`⚠️  Login SUCCEEDED without email confirmation! (confirmation not enforced?)`);
  }

  return true;
}

async function main() {
  console.log('=== Email Confirmation Flow Test ===');
  console.log(`Timestamp: ${TS}`);
  console.log(`Redirect: ${REDIRECT}`);

  let passed = 0;
  let failed = 0;

  for (const user of testUsers) {
    const ok = await testSignup(user);
    if (ok) passed++; else failed++;
  }

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);

  if (failed > 0) {
    console.log('\n💡 If you see "Error sending confirmation email":');
    console.log('   1. Check Supabase Dashboard > Authentication > SMTP Settings');
    console.log('   2. Verify SMTP credentials are the SES-specific credentials (NOT the AWS Access Key)');
    console.log('   3. Username format: AKIA... (20 chars), Password: long string starting with B...');
    console.log('   4. Check SES > Account dashboard - is sending enabled (not in sandbox)?');
  }
}

main().catch(console.error);
