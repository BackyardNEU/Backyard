import PgBoss from 'pg-boss';
import 'dotenv/config';

export const boss = new PgBoss({ connectionString: process.env.DATABASE_URL });

export async function startQueue() {
  await boss.start();
  console.log('[queue] pg-boss started');

  // Main worker — Phase 3 will replace the console.log with decision layer + channel fan-out
  await boss.work('notifications.dispatch', async ([job]) => {
    console.log('[queue] received notification job:', job.data); //later on we'll implement decision logic, atm it just logs the job data
  });

  await boss.work('notifications.archive', async () => {
    console.log('[queue] archive job fired — wire up SQL in Phase 3');
  });

  await boss.schedule('notifications.archive', '0 3 * * *');

  console.log('[queue] workers registered');
}
