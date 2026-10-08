/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔐 ONE-TIME PRODUCTION ADMIN USER CREATION/UPDATE SCRIPT
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * PURPOSE: Safely create or update the admin user in production without
 *          creating any other records or deleting existing data.
 *
 * USAGE:
 *   DATABASE_URL="your-production-database-url" \
 *   DEMO_ADMIN_PASSWORD="your-password" \
 *   npx tsx scripts/create-production-admin.ts
 *
 * FOR RAILWAY:
 *   railway run -- DEMO_ADMIN_PASSWORD="your-password" npx tsx scripts/create-production-admin.ts
 *
 * SAFETY:
 *   - Creates or updates ONLY the admin@smartride.com user
 *   - Does NOT delete any records
 *   - Does NOT create drivers, commuters, plans, routes, vehicles, etc.
 *   - Does NOT run prisma db seed
 *   - Logs do NOT expose the password or password hash
 *   - Requires DEMO_ADMIN_PASSWORD environment variable (min 8 chars)
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@smartride.com';
  const adminName = 'Elena Rostova';
  const adminPhone = '+1 (555) 019-2834';
  const adminRole = 'ADMIN';
  const adminAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
  const newPassword = process.env.DEMO_ADMIN_PASSWORD;

  // Safety check: Ensure password is provided
  if (!newPassword) {
    console.error('❌ ERROR: DEMO_ADMIN_PASSWORD environment variable is not set.');
    console.error('Please set DEMO_ADMIN_PASSWORD to the admin password.');
    process.exit(1);
  }

  // Safety check: Password must be at least 8 characters
  if (newPassword.length < 8) {
    console.error('❌ ERROR: Password must be at least 8 characters long.');
    process.exit(1);
  }

  console.log('🔐 Starting admin user creation/update...');
  console.log(`📧 Target admin email: ${adminEmail}`);
  console.log(`🔑 Password length: ${newPassword.length} characters`);

  try {
    // Step 1: Check if admin user already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    // Step 2: Hash the new password
    console.log('🔒 Hashing password with bcrypt (10 salt rounds)...');
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    if (existingAdmin) {
      // User exists: Update passwordHash and ensure role is ADMIN
      console.log(`👤 Found existing user: ${existingAdmin.name} (ID: ${existingAdmin.id}, Role: ${existingAdmin.role})`);

      if (existingAdmin.role !== adminRole) {
        console.log(`⚠️  User role is ${existingAdmin.role}, updating to ${adminRole}...`);
      }

      const updatedUser = await prisma.user.update({
        where: { email: adminEmail },
        data: {
          passwordHash: newPasswordHash,
          role: adminRole,
          updatedAt: new Date(),
        },
      });

      console.log('✅ SUCCESS: Admin user password has been updated.');
      console.log(`📧 Email: ${updatedUser.email}`);
      console.log(`👤 Name: ${updatedUser.name}`);
      console.log(`🔑 Role: ${updatedUser.role}`);
      console.log(`🆔 User ID: ${updatedUser.id}`);
      console.log(`🕐 Updated at: ${updatedUser.updatedAt.toISOString()}`);
    } else {
      // User does not exist: Create new admin user
      console.log('👤 Admin user does not exist, creating new user...');

      const newUser = await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: newPasswordHash,
          name: adminName,
          phone: adminPhone,
          role: adminRole,
          avatar: adminAvatar,
        },
      });

      console.log('✅ SUCCESS: Admin user has been created.');
      console.log(`📧 Email: ${newUser.email}`);
      console.log(`👤 Name: ${newUser.name}`);
      console.log(`📞 Phone: ${newUser.phone}`);
      console.log(`🔑 Role: ${newUser.role}`);
      console.log(`🆔 User ID: ${newUser.id}`);
      console.log(`🕐 Created at: ${newUser.createdAt.toISOString()}`);
    }

    console.log('');
    console.log('🎉 You can now log in with the admin credentials.');
    console.log('💡 Login URL: https://your-app-domain.com/login');

  } catch (error) {
    console.error('❌ ERROR: Failed to create or update admin user.');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
