import { PrismaClient, UserRole, StatusType, AssetStatus, AssetCondition, BookingStatus, MaintenancePriority, MaintenanceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean old data in correct order due to FK constraints
  await prisma.auditLog.deleteMany({});
  await prisma.auditItem.deleteMany({});
  await prisma.auditAuditor.deleteMany({});
  await prisma.auditCycle.deleteMany({});
  await prisma.maintenanceRequest.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.transferRequest.deleteMany({});
  await prisma.allocation.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.assetCategory.deleteMany({});
  
  // Set department head reference to null first before clearing users
  await prisma.department.updateMany({ data: { headUserId: null } });
  await prisma.user.deleteMany({});
  await prisma.department.deleteMany({});

  const passwordHash = await bcrypt.hash('adminpassword', 10);
  const employeePasswordHash = await bcrypt.hash('employeepassword', 10);

  // 1. Create default admin
  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@company.com',
      passwordHash: passwordHash,
      role: UserRole.ADMIN,
      status: StatusType.ACTIVE,
    },
  });

  // 2. Create users who will head departments
  const samiiqbal = await prisma.user.create({
    data: {
      name: 'Sami Iqbal',
      email: 'sami@company.com',
      passwordHash: employeePasswordHash,
      role: UserRole.DEPARTMENT_HEAD,
      status: StatusType.ACTIVE,
    },
  });

  const rohanmehta = await prisma.user.create({
    data: {
      name: 'Rohan Mehta',
      email: 'rohan@company.com',
      passwordHash: employeePasswordHash,
      role: UserRole.DEPARTMENT_HEAD,
      status: StatusType.ACTIVE,
    },
  });

  // Create an Asset Manager
  const manager = await prisma.user.create({
    data: {
      name: 'Sarah Connor',
      email: 'sarah@company.com',
      passwordHash: employeePasswordHash,
      role: UserRole.ASSET_MANAGER,
      status: StatusType.ACTIVE,
    },
  });

  // Create standard employees
  const priya = await prisma.user.create({
    data: {
      name: 'Priya Shah',
      email: 'priya@company.com',
      passwordHash: employeePasswordHash,
      role: UserRole.EMPLOYEE,
      status: StatusType.ACTIVE,
    },
  });

  const raj = await prisma.user.create({
    data: {
      name: 'Raj Patel',
      email: 'raj@company.com',
      passwordHash: employeePasswordHash,
      role: UserRole.EMPLOYEE,
      status: StatusType.ACTIVE,
    },
  });

  // 3. Create departments
  const itDept = await prisma.department.create({
    data: {
      name: 'IT Department',
      headUserId: samiiqbal.id,
      status: StatusType.ACTIVE,
    },
  });

  const facilitiesDept = await prisma.department.create({
    data: {
      name: 'Facilities',
      headUserId: rohanmehta.id,
      status: StatusType.ACTIVE,
    },
  });

  const fieldOpsDept = await prisma.department.create({
    data: {
      name: 'Field Ops (East)',
      headUserId: samiiqbal.id,
      status: StatusType.ACTIVE,
    },
  });

  // Update users with department assignments
  await prisma.user.update({
    where: { id: samiiqbal.id },
    data: { departmentId: itDept.id },
  });
  await prisma.user.update({
    where: { id: rohanmehta.id },
    data: { departmentId: facilitiesDept.id },
  });
  await prisma.user.update({
    where: { id: priya.id },
    data: { departmentId: itDept.id },
  });
  await prisma.user.update({
    where: { id: raj.id },
    data: { departmentId: fieldOpsDept.id },
  });

  // 4. Create Asset Categories with custom fields schemas
  const electronicsCat = await prisma.assetCategory.create({
    data: {
      name: 'Electronics',
      description: 'Laptops, projectors, monitors, and other hardware.',
      customFieldsSchema: {
        warranty_months: 'number',
        manufacturer: 'string',
      },
    },
  });

  const furnitureCat = await prisma.assetCategory.create({
    data: {
      name: 'Furniture',
      description: 'Chairs, desks, conference tables.',
      customFieldsSchema: {
        material: 'string',
      },
    },
  });

  const vehicleCat = await prisma.assetCategory.create({
    data: {
      name: 'Vehicles',
      description: 'Company vans, trucks, and sedans.',
      customFieldsSchema: {
        license_plate: 'string',
        mileage: 'number',
      },
    },
  });

  // 5. Create Mock Assets
  const laptop = await prisma.asset.create({
    data: {
      assetTag: 'AF-0012',
      name: 'Dell Latitude 5420',
      categoryId: electronicsCat.id,
      serialNumber: 'DL-5420-9988',
      acquisitionDate: new Date('2025-01-10'),
      acquisitionCost: 1200.00,
      currentCondition: AssetCondition.GOOD,
      location: 'Bengaluru Office',
      status: AssetStatus.ALLOCATED,
      sharedBookable: false,
      customFieldValues: {
        warranty_months: 36,
        manufacturer: 'Dell',
      },
    },
  });

  const projector = await prisma.asset.create({
    data: {
      assetTag: 'AF-0062',
      name: 'Epson Projector H100',
      categoryId: electronicsCat.id,
      serialNumber: 'EP-H100-3344',
      acquisitionDate: new Date('2024-05-15'),
      acquisitionCost: 750.00,
      currentCondition: AssetCondition.DAMAGED,
      location: 'HQ Floor 2',
      status: AssetStatus.UNDER_MAINTENANCE,
      sharedBookable: true,
      customFieldValues: {
        warranty_months: 24,
        manufacturer: 'Epson',
      },
    },
  });

  const chair = await prisma.asset.create({
    data: {
      assetTag: 'AF-0201',
      name: 'Ergonomic Office Chair',
      categoryId: furnitureCat.id,
      serialNumber: 'EC-CHAIR-4455',
      acquisitionDate: new Date('2025-02-20'),
      acquisitionCost: 250.00,
      currentCondition: AssetCondition.NEW,
      location: 'Warehouse A',
      status: AssetStatus.AVAILABLE,
      sharedBookable: false,
      customFieldValues: {
        material: 'Mesh & Leather',
      },
    },
  });

  const roomB2 = await prisma.asset.create({
    data: {
      assetTag: 'AF-0300',
      name: 'Conference Room B2',
      categoryId: furnitureCat.id,
      serialNumber: 'ROOM-B2-HQ',
      acquisitionDate: new Date('2023-01-01'),
      acquisitionCost: 0.00,
      currentCondition: AssetCondition.GOOD,
      location: 'HQ Floor 1',
      status: AssetStatus.AVAILABLE,
      sharedBookable: true,
      customFieldValues: {
        material: 'Drywall & Glass',
      },
    },
  });

  // 6. Create active allocations and bookings
  await prisma.allocation.create({
    data: {
      assetId: laptop.id,
      allocatedToUserId: priya.id,
      allocatedById: manager.id,
      allocationDate: new Date('2026-03-12'),
      expectedReturnDate: new Date('2026-09-12'),
      isActive: true,
    },
  });

  await prisma.booking.create({
    data: {
      assetId: roomB2.id,
      bookedById: priya.id,
      startTime: new Date('2026-07-15T09:00:00Z'),
      endTime: new Date('2026-07-15T10:00:00Z'),
      status: BookingStatus.UPCOMING,
    },
  });

  // 7. Create maintenance request
  await prisma.maintenanceRequest.create({
    data: {
      assetId: projector.id,
      requestedById: priya.id,
      priority: MaintenancePriority.HIGH,
      status: MaintenanceStatus.PENDING,
      description: 'Projector bulb is flickering and not turning on consistently.',
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
