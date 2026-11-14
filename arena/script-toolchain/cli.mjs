import { createInterface } from 'node:readline';
import { compileRule } from './src/compile.mjs';

for await (const line of createInterface({ input: process.stdin })) {
  try {
    process.stdout.write(`${JSON.stringify(await compileRule(JSON.parse(line)))}\n`);
  } catch (error) {
    console.error(error.message);
    process.stdout.write(`${JSON.stringify({ diagnostics: [{
      file: '', line: 0, column: 0, message: error.message, severity: 'error', code: 'INPUT',
    }] })}\n`);
  }
}
