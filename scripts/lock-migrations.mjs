// Registra en src/modules/migrations.lock.json la huella de las migraciones nuevas.
// Las ya registradas no se tocan: una migración publicada no cambia.
// Uso: npm run lock-migrations
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["vitest", "run", "src/modules/migrations.test.ts"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, VENTAMAS_LOCK_MIGRATIONS: "1" },
});
process.exit(result.status ?? 1);
