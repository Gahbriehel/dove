import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial church, system roles, and super admin user...');

  // 1. Seed Default Church
  const churchName =
    process.env.DEFAULT_CHURCH_NAME || 'Amazing Grace Bible Church';
  const churchSlug = process.env.DEFAULT_CHURCH_SLUG || 'abwog';

  const defaultChurch = await prisma.church.upsert({
    where: { slug: churchSlug },
    update: { name: churchName },
    create: {
      name: churchName,
      slug: churchSlug,
    },
  });

  console.log(
    `Default Church ensured: ${defaultChurch.name} (ID: ${defaultChurch.id}, Slug: ${defaultChurch.slug})`,
  );

  // 2. Seed Roles
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: {
      name: 'SUPER_ADMIN',
      description: 'System-wide Super Administrator with full permissions',
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description:
        'Church Administrator with event and people management permissions',
    },
  });

  const coordinatorRole = await prisma.role.upsert({
    where: { name: 'COORDINATOR' },
    update: {},
    create: {
      name: 'COORDINATOR',
      description:
        'Event Coordinator with event, team, game, score, and attendance management permissions',
    },
  });

  const registrationDeskRole = await prisma.role.upsert({
    where: { name: 'REGISTRATION_DESK' },
    update: {},
    create: {
      name: 'REGISTRATION_DESK',
      description:
        'Registration Desk Staff with attendee check-in and registration view permissions',
    },
  });

  console.log(
    `Roles ensured: ${superAdminRole.name}, ${adminRole.name}, ${coordinatorRole.name}, ${registrationDeskRole.name}`,
  );

  // 3. Seed Super Admin User
  const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@church.org';
  const rawPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const existingSuperAdmin = await prisma.user.findUnique({
    where: { email },
  });

  if (!existingSuperAdmin) {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        isActive: true,
        churchId: defaultChurch.id,
        userRoles: {
          create: {
            roleId: superAdminRole.id,
          },
        },
      },
    });

    console.log(`Super Admin user created successfully: ${user.email}`);
  } else {
    // Ensure Super Admin is linked to the seeded church and role
    await prisma.user.update({
      where: { id: existingSuperAdmin.id },
      data: { churchId: defaultChurch.id },
    });
    // Ensure Super Admin role is attached
    const hasRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: existingSuperAdmin.id,
          roleId: superAdminRole.id,
        },
      },
    });

    if (!hasRole) {
      await prisma.userRole.create({
        data: {
          userId: existingSuperAdmin.id,
          roleId: superAdminRole.id,
        },
      });
      console.log(`Attached SUPER_ADMIN role to existing user: ${email}`);
    } else {
      console.log(`Super Admin user already exists: ${email}`);
    }
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
