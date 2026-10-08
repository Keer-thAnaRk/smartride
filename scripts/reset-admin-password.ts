/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔐 ONE-TIME ADMIN PASSWORD RESET SCRIPT
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * PURPOSE: Safely update the admin user's password in production without
 *          deleting any existing data.
 *
 * USAGE:
 *   DATABASE_URL="your-production-database-url" \
 *   DEMO_ADMIN_PASSWORD="your-new-password" \
 *   npx tsx scripts/reset-admin-password.ts
 *
 * FOR RAILWAY:
 *   railway run -- DEMO_ADMIN_PASSWORD="your-new-password" npx tsx scripts/reset-admin-password.ts
 *
 * SAFETY:
 *   - Updates ONLY the admin@smartride.com user
 *   - Does NOT delete any records
 *   - Does NOT run prisma db seed
 *   - Does NOT reset the database
 *   - Logs do NOT expose the password
 *   - Requires DEMO_ADMIN_PASSWORD environment variable
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@smartride.com';
  const newPassword = process.env.DEMO_ADMIN_PASSWORD;

  // Safety check: Ensure password is provided
  if (!newPassword) {
    console.error('❌ ERROR: DEMO_ADMIN_PASSWORD environment variable is not set.');
    console.error('Please set DEMO_ADMIN_PASSWORD to the new admin password.');
    process.exit(1);
  }

  // Safety check: Password must be at least 8 characters
  if (newPassword.length < 8) {
    console.error('❌ ERROR: Password must be at least 8 characters long.');
    process.exit(1);
  }

  console.log('🔐 Starting admin password reset...');
  console.log(`📧 Target admin email: ${adminEmail}`);
  console.log(`🔑 Password length: ${newPassword.length} characters`);

  try {
    // Step 1: Find the existing admin user
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      console.error(`❌ ERROR: Admin user with email ${adminEmail} not found.`);
      console.error('No records were modified.');
      process.exit(1);
    }

    if (existingAdmin.role !== 'ADMIN') {
      console.error(`❌ ERROR: User ${adminEmail} exists but is not an ADMIN (role: ${existingAdmin.role}).`);
      console.error('No records were modified.');
      process.exit(1);
    }

    console.log(`✅ Found admin user: ${existingAdmin.name} (ID: ${existingAdmin.id})`);

    // Step 2: Hash the new password
    console.log('🔒 Hashing new password with bcrypt (10 salt rounds)...');
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Step 3: Update ONLY the admin user's passwordHash
    console.log('🔄 Updating passwordHash in database...');
    const updatedUser = await prisma.user.update({
      where: { email: adminEmail },
      data: {
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      },
    });

    console.log('✅ SUCCESS: Admin password has been updated.');
    console.log(`📧 Email: ${updatedUser.email}`);
    console.log(`👤 Name: ${updatedUser.name}`);
    console.log(`🆔 User ID: ${updatedUser.id}`);
    console.log(`🕐 Updated at: ${updatedUser.updatedAt.toISOString()}`);
    console.log('');
    console.log('🎉 You can now log in with the new password.');
    console.log('💡 Login URL: https://your-app-domain.com/login');

  } catch (error) {
    console.error('❌ ERROR: Failed to update admin password.');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
