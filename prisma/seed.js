import { PrismaClient } from '@prisma/client';
import { addDays, format } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // 1. Seed ClinicSettings
  const clinicSettings = await prisma.clinicSettings.create({
    data: {
      clinicName: 'BrightSmile Dental Clinic',
      address: '123 King Street West, Toronto, ON',
      phone: '416-555-0199',
      timezone: 'Asia/Karachi',
    },
  });
  console.log('Created clinic settings:', clinicSettings.clinicName);

  // Helper dates
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);
  const lastWeek = addDays(today, -7);

  // 2. Seed Patients
  const patient1 = await prisma.patient.create({
    data: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '4161234567'
    }
  });

  const patient2 = await prisma.patient.create({
    data: {
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      phone: '4169876543'
    }
  });

  const patient3 = await prisma.patient.create({
    data: {
      name: 'Mike Johnson',
      email: 'mike.j@example.com',
      phone: '4165558888'
    }
  });

  console.log('Created patients.');

  // 3. Seed Appointments
  // SCHEDULED (future)
  const appt1 = await prisma.appointment.create({
    data: {
      patientId: patient1.id,
      reason: 'Routine checkup',
      appointmentDate: format(nextWeek, 'yyyy-MM-dd'),
      appointmentTime: '10:00',
      status: 'SCHEDULED',
    },
  });

  // CONFIRMED (future)
  const appt2 = await prisma.appointment.create({
    data: {
      patientId: patient2.id,
      reason: 'Tooth pain',
      appointmentDate: format(tomorrow, 'yyyy-MM-dd'),
      appointmentTime: '14:30',
      status: 'CONFIRMED',
    },
  });

  // COMPLETED (past)
  const appt3 = await prisma.appointment.create({
    data: {
      patientId: patient3.id,
      reason: 'Teeth cleaning',
      appointmentDate: format(lastWeek, 'yyyy-MM-dd'),
      appointmentTime: '09:00',
      status: 'COMPLETED',
    },
  });

  console.log('Created appointments:');
  console.log(`- ${patient1.name} (${appt1.status}) on ${appt1.appointmentDate}`);
  console.log(`- ${patient2.name} (${appt2.status}) on ${appt2.appointmentDate}`);
  console.log(`- ${patient3.name} (${appt3.status}) on ${appt3.appointmentDate}`);

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
