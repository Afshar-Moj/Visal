import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const exists = async path => access(new URL(`../${path}`, import.meta.url));

const html = await read("index.html");
const auth = await read("auth.js");
const config = await read("supabase-config.js");
const app = await read("app.js");
const migration1 = await read("supabase/migrations/0001_initial_schema.sql");
const migration2 = await read("supabase/migrations/0002_signup_profile_trigger.sql");
const migration3 = await read("supabase/migrations/0003_private_block_helper.sql");
const migration4 = await read("supabase/migrations/0004_lock_birth_date.sql");

for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const target = match[1];
  if (/^(?:https?:|mailto:|tel:|#|data:)/i.test(target)) continue;
  const localPath = target.split(/[?#]/, 1)[0];
  if (localPath) await exists(localPath);
}

for (const required of ["styles.css", "supabase-config.js", "app.js", "auth.js", "rules.html", "privacy.html"]) {
  await exists(required);
}

assert.match(html, /name="robots" content="noindex, nofollow"/i, "The unfinished site must remain noindex.");
assert.match(html, /name="birth_date"/, "Signup must collect a date of birth.");
assert.match(auth, /signUp\(/, "Signup flow is missing.");
assert.match(auth, /signInWithPassword\(/, "Login flow is missing.");
assert.match(auth, /const age = getAge\(birthDate\);[\s\S]*?if \(age < 18\)/, "Client-side 18+ check is missing.");
assert.match(auth, /birth_date:\s*String\(data\.get\("birth_date"\)\)/, "Birth date must be sent to the signup trigger.");
assert.match(auth, /if \(age === null\)/, "Invalid birth dates must be rejected before signup.");
assert.match(auth, /date\.toISOString\(\)\.slice\(0, 10\) !== birthDate/, "Impossible calendar dates must be rejected.");
assert.match(app, /پروفایل نمونه/, "Demo profiles must be clearly labelled.");
assert.doesNotMatch(config, /(?:service_role|secret[_-]?key)\s*:/i, "A server secret must never be configured in browser code.");

for (const table of ["profiles", "private_user_data", "user_blocks", "conversations", "messages", "user_reports"]) {
  assert.match(migration1, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `RLS is missing for ${table}.`);
}

assert.match(migration1, /create table if not exists public\.private_user_data/i, "Private birth-date table is missing.");
assert.match(migration1, /create trigger private_user_data_validate_birth_date/i, "Database-side age validation is missing.");
assert.ok(migration1.includes("new.birth_date > (current_date - interval '18 years')::date"), "The database must reject anyone younger than 18.");
assert.match(migration2, /after insert on auth\.users/i, "Signup profile trigger is missing.");
assert.match(migration3, /create schema if not exists private/i, "Private schema for block checks is missing.");
assert.doesNotMatch(migration3, /create or replace function public\.is_blocked_pair/i, "Block helper must not be recreated in the public API schema.");
assert.match(migration4, /drop policy if exists "private_data_update_own" on public\.private_user_data/i, "Client-side birth-date editing must be disabled.");

console.log("Visal static project checks passed.");
