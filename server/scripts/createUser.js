/**
 * Utilidad CLI para dar de alta usuarios de forma segura en PRODUCCIÓN
 * cuando el registro público (ALLOW_PUBLIC_REGISTRATION=false) está desactivado.
 *
 * Uso:
 *   node server/scripts/createUser.js "Nombre Completo" "email@dominio.com" "ContraseñaSegura123"
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { hashPassword } from '../utils/auth.js';

dotenv.config();

async function main() {
  const [, , name, email, password, primarySport = 'Ride', location = 'Azuqueca de Henares, Guadalajara'] =
    process.argv;

  if (!name || !email || !password) {
    console.error('Uso: node server/scripts/createUser.js "<Nombre>" "<Email>" "<Contraseña>" [Modalidad] [Ubicación]');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI no definido en .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    console.error(`Ya existe un usuario con el email ${normalizedEmail}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    primarySport,
    location
  });

  console.log(`✅ Usuario creado correctamente: ${user.name} (${user.email}) [ID: ${user._id}]`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error creando usuario:', err.message);
  process.exit(1);
});
