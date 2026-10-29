const userService = require('../services/userService');

/**
 * Crea el primer superadministrador a partir de variables de entorno (contrato 4.1):
 *   SEED_SUPERADMIN_EMAIL, SEED_SUPERADMIN_PASSWORD (12 a 128 caracteres) y, opcional,
 *   SEED_SUPERADMIN_NOMBRE.
 * No hay contraseña por defecto en el repositorio: sin las variables, no se crea nada.
 * Es idempotente: si ya existe un superadministrador, no crea otro.
 */
async function seedSuperadmin() {
  const email = process.env.SEED_SUPERADMIN_EMAIL;
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  const nombre = process.env.SEED_SUPERADMIN_NOMBRE || 'Superadministrador';

  if (!email || !password) {
    console.log('[seed] SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD no definidos: no se crea superadministrador.');
    return null;
  }

  try {
    const created = await userService.bootstrapSuperadmin({ nombre, email, password });
    if (created) {
      console.log(`[seed] Superadministrador creado: ${created.email}`);
    } else {
      console.log('[seed] Ya existe un superadministrador: no se crea otro.');
    }
    return created;
  } catch (err) {
    // Se informan los campos con problema, nunca los valores (la contraseña no se imprime).
    const fields = Array.isArray(err.details) ? err.details.map((d) => `${d.field}: ${d.issue}`).join('; ') : '';
    throw new Error(`No se pudo crear el superadministrador. ${err.message} ${fields}`.trim());
  }
}

module.exports = { seedSuperadmin };

// Uso como comando puntual (solo tiene sentido cuando los usuarios se guardan en PostgreSQL):
//   node --env-file=.env src/bootstrap/seedSuperadmin.js
if (require.main === module) {
  seedSuperadmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`[seed] ${err.message}`);
      process.exit(1);
    });
}
