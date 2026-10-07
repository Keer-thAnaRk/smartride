import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getUserById,
  getDriverProfileByUserId,
  getAllDriverProfiles,
  setDriverProfile,
  updateDriverProfile,
  getVehiclesByDriverId,
  setVehicle,
  updateVehicle,
  getAllRoutes,
  FirestoreDriverProfile,
  FirestoreVehicle,
} from '@/lib/firestore-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (session.role !== 'DRIVER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Driver access required' }, { status: 403 });
    }

    let driverProfile: FirestoreDriverProfile | null = null;
    if (session.role === 'DRIVER') {
      driverProfile = await getDriverProfileByUserId(session.id);
    } else {
      const allDrivers = await getAllDriverProfiles();
      driverProfile = allDrivers[0] || null;
    }

    if (!driverProfile) {
      return NextResponse.json({ success: true, driverProfile: null });
    }

    const [user, vehicles, allRoutes] = await Promise.all([
      getUserById(driverProfile.userId),
      getVehiclesByDriverId(driverProfile.id),
      getAllRoutes(),
    ]);

    const routes = allRoutes.filter((r) => r.assignedDriverId === driverProfile!.id);

    const fullDriverProfile = {
      ...driverProfile,
      user: user
        ? {
            name: user.name,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar,
          }
        : null,
      vehicles,
      routes,
    };

    return NextResponse.json({ success: true, driverProfile: fullDriverProfile });
  } catch (error: any) {
    console.error('Driver onboarding fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch driver info' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }
    if (session.role !== 'DRIVER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Driver access required' }, { status: 403 });
    }

    const body = await req.json();
    const {
      licenseNumber,
      experienceYears,
      make,
      model,
      year,
      licensePlate,
      capacity,
      type,
      rcDocUrl,
      insuranceDocUrl,
    } = body;

    let driverProfile: FirestoreDriverProfile | null = null;
    if (session.role === 'DRIVER') {
      driverProfile = await getDriverProfileByUserId(session.id);
    } else {
      const allDrivers = await getAllDriverProfiles();
      driverProfile = allDrivers[0] || null;
    }

    if (!driverProfile) {
      const newDriverId = `driver_${session.id}`;
      driverProfile = {
        id: newDriverId,
        userId: session.id,
        licenseNumber: licenseNumber || null,
        experienceYears: parseInt(experienceYears) || 3,
        rating: 5.0,
        isVerified: false,
        status: 'OFFLINE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await setDriverProfile(driverProfile);
    } else {
      await updateDriverProfile(driverProfile.id, {
        licenseNumber: licenseNumber || driverProfile.licenseNumber,
        experienceYears: experienceYears
          ? parseInt(experienceYears)
          : driverProfile.experienceYears,
        isVerified: false,
      });
    }

    if (licensePlate) {
      const existingVehicles = await getVehiclesByDriverId(driverProfile.id);
      const existingVehicle = existingVehicles[0] || null;

      if (existingVehicle) {
        await updateVehicle(existingVehicle.id, {
          make: make || existingVehicle.make,
          model: model || existingVehicle.model,
          year: year ? parseInt(year) : existingVehicle.year,
          licensePlate: licensePlate || existingVehicle.licensePlate,
          capacity: capacity ? parseInt(capacity) : existingVehicle.capacity,
          type: type || existingVehicle.type,
          rcDocUrl: rcDocUrl !== undefined ? rcDocUrl : existingVehicle.rcDocUrl,
          insuranceDocUrl:
            insuranceDocUrl !== undefined ? insuranceDocUrl : existingVehicle.insuranceDocUrl,
          isApproved: false,
        });
      } else {
        const newVehicle: FirestoreVehicle = {
          id: `veh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          driverId: driverProfile.id,
          make: make || 'Toyota',
          model: model || 'Innova',
          year: year ? parseInt(year) : 2023,
          licensePlate,
          capacity: capacity ? parseInt(capacity) : 4,
          type: type || 'SEDAN',
          isApproved: false,
          rcDocUrl: rcDocUrl || null,
          insuranceDocUrl: insuranceDocUrl || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await setVehicle(newVehicle);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Driver profile and vehicle details submitted for verification!',
    });
  } catch (error: any) {
    console.error('Driver onboarding update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update onboarding info' },
      { status: 500 }
    );
  }
}

