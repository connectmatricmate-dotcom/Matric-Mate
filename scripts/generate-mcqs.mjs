#!/usr/bin/env node
/**
 * Draft MCQs with AI, into the review queue, from the operator's seat.
 *
 *   node scripts/generate-mcqs.mjs phy "Newton's laws of motion" 10
 *   node scripts/generate-mcqs.mjs bio "Cell structure" 6 ur
 *
 * Deliberately a script and not an API route: generation spends real money
 * per call, so it must not be reachable from the internet. And deliberately
 * writing to generated_mcqs with review_status='review', never to the mcqs
 * bank: students only ever see a generated question after a person has read
 * it and flipped it to published (Supabase Studio until the M7 admin CMS).
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const [subjectId, topic, countArg, mediumArg] = process.argv.slice(2);
if (!subjectId || !topic) {
  console.error('usage: node scripts/generate-mcqs.mjs <subjectId> <topic> [count=8] [medium=en]');
  process.exit(1);
}
const count = Math.min(20, Math.max(1, Number(countArg) || 8));
const medium = mediumArg === 'ur' ? 'ur' : 'en';

const text = await readFile(resolve(ROOT, 'apps/web/.env.local'), 'utf8');
const env = {};
for (const line of text.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Same model as the tutor. A separate constant on purpose: drafting question
// banks and answering students are different jobs and can diverge later.
const GENERATOR_MODEL = 'claude-sonnet-5';

const SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          answer: { type: 'integer', enum: [0, 1, 2, 3] },
          explanation: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        },
        required: ['q', 'options', 'answer', 'explanation', 'difficulty'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
};

console.log(`drafting ${count} ${medium} MCQs · ${subjectId} · ${topic}`);

const response = await anthropic.messages.create({
  model: GENERATOR_MODEL,
  max_tokens: 8000,
  output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  system:
    'You write exam questions for FBISE Class 9 (SSC-I, Pakistan, 2022-23 National Curriculum assessment framework). ' +
    'Every question must match the board style: single correct answer, four options, plausible distractors drawn from ' +
    'common student mistakes, and a one-or-two-sentence explanation of why the answer is right. ' +
    (medium === 'ur'
      ? 'Write the questions in Urdu, keeping technical terms in English the way Pakistani textbooks do.'
      : 'Write in clear, simple English suited to a 14-year-old.'),
  messages: [
    {
      role: 'user',
      content: `Write exactly ${count} multiple-choice questions on "${topic}" for subject "${subjectId}". Mixed difficulty, exactly 4 options each.`,
    },
  ],
});

if (response.stop_reason === 'refusal') {
  console.error('the model declined this request');
  process.exit(1);
}
const block = response.content.find((b) => b.type === 'text');
const parsed = JSON.parse(block.text);

const rows = parsed.questions
  .filter((q) => Array.isArray(q.options) && q.options.length === 4)
  .map((q) => ({
    subject_id: subjectId,
    topic,
    medium,
    q: q.q,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    difficulty: q.difficulty,
    review_status: 'review',
  }));

const { error } = await db.from('generated_mcqs').insert(rows);
if (error) {
  console.error(`insert failed: ${error.message}`);
  process.exit(1);
}
console.log(`saved ${rows.length} drafts to generated_mcqs (review_status=review)`);
console.log('review them in Supabase Studio and set review_status=published to release.');
