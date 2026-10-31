// Regenera src/data/program.json a partir de program.ts. Requiere Node ≥ 24 (ejecuta TypeScript).
import { writeFileSync } from 'node:fs';
import { PROGRAM, ROUTINES } from '../src/data/program.ts';

const target = new URL('../src/data/program.json', import.meta.url);
writeFileSync(target, `${JSON.stringify({ ROUTINES, PROGRAM }, null, 2)}\n`);
