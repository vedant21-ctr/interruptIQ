import { PrismaClient } from '@prisma/client';

export async function isDatabaseAvailable(prisma: PrismaClient): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
