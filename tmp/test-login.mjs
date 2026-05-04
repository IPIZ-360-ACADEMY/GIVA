import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const content = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of content.split('\n')) {
  const eq = line.indexOf('=');
  if (eq > 0) {
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq+1).trim().replace(/^['"]/,'').replace(/['"]$/,'');
    env[k] = v;
  }
}
const supabase = createClient(env.VITE_SUPABASE_URL || env.SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Testar admin
const r1 = await supabase.auth.signInWithPassword({ email: 'admin@giva.ao', password: 'ipiz2026' });
console.log('ADMIN ipiz2026:', r1.error?.message ?? 'OK - ' + r1.data?.user?.email);
await supabase.auth.signOut();

// Testar I412 (criado via browser - pode ter outro password)
const r4 = await supabase.auth.signInWithPassword({ email: 'aluno.i412@giva.ao', password: 'ipiz2026' });
console.log('I412 ipiz2026:', r4.error?.message ?? 'OK - ' + r4.data?.user?.email);
await supabase.auth.signOut();

// Testar I422
const r5 = await supabase.auth.signInWithPassword({ email: 'aluno.i422@giva.ao', password: 'ipiz2026' });
console.log('I422 ipiz2026:', r5.error?.message ?? 'OK - ' + r5.data?.user?.email);
await supabase.auth.signOut();

// Testar I776
const r6 = await supabase.auth.signInWithPassword({ email: 'aluno.i776@giva.ao', password: 'ipiz2026' });
console.log('I776 ipiz2026:', r6.error?.message ?? 'OK - ' + r6.data?.user?.email);
await supabase.auth.signOut();

// Testar I299304
const r7 = await supabase.auth.signInWithPassword({ email: 'aluno.i299304@giva.ao', password: 'ipiz2026' });
console.log('I299304 ipiz2026:', r7.error?.message ?? 'OK - ' + r7.data?.user?.email);
await supabase.auth.signOut();
