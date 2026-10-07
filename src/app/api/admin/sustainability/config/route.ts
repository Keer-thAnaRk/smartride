import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  DEFAULT_SUSTAINABILITY_CONFIG,
  SustainabilityConfig,
} from '@/lib/sustainability/carbon-config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let config = await prisma.sustainabilityModelConfig.findUnique({
      where: { id: 'active_config' },
    });

    if (!config) {
      config = await prisma.sustainabilityModelConfig.create({
        data: {
          id: 'active_config',
          modelVersion: DEFAULT_SUSTAINABILITY_CONFIG.modelVersion,
          baselineCarEmissionKgPerKm: DEFAULT_SUSTAINABILITY_CONFIG.baselineCarEmissionKgPerKm,
          baselineCarOccupancy: DEFAULT_SUSTAINABILITY_CONFIG.baselineCarOccupancy,
          shuttleSedanKgPerKm: DEFAULT_SUSTAINABILITY_CONFIG.shuttleEmissionsKgPerKm.SEDAN,
          shuttleSuvKgPerKm: DEFAULT_SUSTAINABILITY_CONFIG.shuttleEmissionsKgPerKm.SUV,
          shuttleVanKgPerKm: DEFAULT_SUSTAINABILITY_CONFIG.shuttleEmissionsKgPerKm.VAN,
          shuttleMiniBusKgPerKm: DEFAULT_SUSTAINABILITY_CONFIG.shuttleEmissionsKgPerKm.MINI_BUS,
          workingDaysPerMonth: DEFAULT_SUSTAINABILITY_CONFIG.workingDaysPerMonth,
          tripsPerWorkingDay: DEFAULT_SUSTAINABILITY_CONFIG.tripsPerWorkingDay,
          updatedBy: 'SYSTEM',
        },
      });
    }

    const formattedConfig: SustainabilityConfig = {
      modelVersion: config.modelVersion,
      baselineCarEmissionKgPerKm: config.baselineCarEmissionKgPerKm,
      baselineCarOccupancy: config.baselineCarOccupancy,
      shuttleEmissionsKgPerKm: {
        SEDAN: config.shuttleSedanKgPerKm,
        SUV: config.shuttleSuvKgPerKm,
        VAN: config.shuttleVanKgPerKm,
        MINI_BUS: config.shuttleMiniBusKgPerKm,
      },
      workingDaysPerMonth: config.workingDaysPerMonth,
      tripsPerWorkingDay: config.tripsPerWorkingDay,
      lastUpdated: config.updatedAt.toISOString(),
      updatedBy: config.updatedBy,
      disclaimerText: `Modeled estimates based on configurable commute assumptions (Model ${config.modelVersion}). Not direct tailpipe sensor measurements.`,
    };

    return NextResponse.json({ success: true, config: formattedConfig });
  } catch (error: any) {
    console.error('Config fetch error:', error);
    return NextResponse.json({ error: 'Failed to retrieve sustainability configuration' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const {
      baselineCarEmissionKgPerKm,
      baselineCarOccupancy,
      shuttleSedanKgPerKm,
      shuttleSuvKgPerKm,
      shuttleVanKgPerKm,
      shuttleMiniBusKgPerKm,
      workingDaysPerMonth,
      tripsPerWorkingDay,
    } = body;

    // Validate ranges
    if (baselineCarEmissionKgPerKm !== undefined && (baselineCarEmissionKgPerKm <= 0 || baselineCarEmissionKgPerKm > 1.0)) {
      return NextResponse.json({ error: 'Invalid baseline car emission factor (must be between 0.01 and 1.0 kg/km)' }, { status: 400 });
    }

    const current = await prisma.sustainabilityModelConfig.findUnique({
      where: { id: 'active_config' },
    });

    // Auto-increment version e.g. "v1.0" -> "v1.1"
    let nextVersion = 'v1.1';
    if (current?.modelVersion) {
      const match = current.modelVersion.match(/v(\d+)\.(\d+)/);
      if (match) {
        const major = parseInt(match[1]);
        const minor = parseInt(match[2]) + 1;
        nextVersion = `v${major}.${minor}`;
      }
    }

    const updated = await prisma.sustainabilityModelConfig.upsert({
      where: { id: 'active_config' },
      update: {
        modelVersion: nextVersion,
        baselineCarEmissionKgPerKm: baselineCarEmissionKgPerKm !== undefined ? Number(baselineCarEmissionKgPerKm) : undefined,
        baselineCarOccupancy: baselineCarOccupancy !== undefined ? Number(baselineCarOccupancy) : undefined,
        shuttleSedanKgPerKm: shuttleSedanKgPerKm !== undefined ? Number(shuttleSedanKgPerKm) : undefined,
        shuttleSuvKgPerKm: shuttleSuvKgPerKm !== undefined ? Number(shuttleSuvKgPerKm) : undefined,
        shuttleVanKgPerKm: shuttleVanKgPerKm !== undefined ? Number(shuttleVanKgPerKm) : undefined,
        shuttleMiniBusKgPerKm: shuttleMiniBusKgPerKm !== undefined ? Number(shuttleMiniBusKgPerKm) : undefined,
        workingDaysPerMonth: workingDaysPerMonth !== undefined ? Number(workingDaysPerMonth) : undefined,
        tripsPerWorkingDay: tripsPerWorkingDay !== undefined ? Number(tripsPerWorkingDay) : undefined,
        updatedBy: session.name || session.email || 'ADMIN',
      },
      create: {
        id: 'active_config',
        modelVersion: 'v1.0',
        baselineCarEmissionKgPerKm: baselineCarEmissionKgPerKm || DEFAULT_SUSTAINABILITY_CONFIG.baselineCarEmissionKgPerKm,
        baselineCarOccupancy: baselineCarOccupancy || DEFAULT_SUSTAINABILITY_CONFIG.baselineCarOccupancy,
        shuttleSedanKgPerKm: shuttleSedanKgPerKm || DEFAULT_SUSTAINABILITY_CONFIG.shuttleEmissionsKgPerKm.SEDAN,
        shuttleSuvKgPerKm: shuttleSuvKgPerKm || DEFAULT_SUSTAINABILITY_CONFIG.shuttleEmissionsKgPerKm.SUV,
        shuttleVanKgPerKm: shuttleVanKgPerKm || DEFAULT_SUSTAINABILITY_CONFIG.shuttleEmissionsKgPerKm.VAN,
        shuttleMiniBusKgPerKm: shuttleMiniBusKgPerKm || DEFAULT_SUSTAINABILITY_CONFIG.shuttleEmissionsKgPerKm.MINI_BUS,
        workingDaysPerMonth: workingDaysPerMonth || DEFAULT_SUSTAINABILITY_CONFIG.workingDaysPerMonth,
        tripsPerWorkingDay: tripsPerWorkingDay || DEFAULT_SUSTAINABILITY_CONFIG.tripsPerWorkingDay,
        updatedBy: session.name || session.email || 'ADMIN',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Sustainability model configuration updated to version ${updated.modelVersion}`,
      config: updated,
    });
  } catch (error: any) {
    console.error('Config update error:', error);
    return NextResponse.json({ error: 'Failed to update sustainability configuration' }, { status: 500 });
  }
}
