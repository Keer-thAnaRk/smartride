import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getSessionFromRequest, signJwtToken } from '@/lib/auth';
import { getUserById, updateUser } from '@/lib/firestore-db';
import prisma from '@/lib/prisma';
import { recordSecurityEvent } from '@/lib/security/security-events';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB limit
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Validates file buffer magic bytes to ensure genuine image content.
 */
function validateImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // WEBP: RIFF....WEBP (first 4 bytes RIFF, bytes 8-11 WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return true;
  }
  return false;
}

/**
 * POST /api/profile/photo
 * Upload or update the authenticated user's profile photo.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the request
    const session = getSessionFromRequest(req);
    if (!session || !session.id) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const userId = session.id;
    const contentType = req.headers.get('content-type') || '';

    let fileBuffer: Buffer | null = null;
    let extension = '.jpg';
    let mimeType = 'image/jpeg';

    // 2. Parse payload based on Content-Type
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'Please select a JPG, PNG, or WEBP image under 5 MB.' },
          { status: 400 }
        );
      }

      mimeType = file.type;
      if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
        return NextResponse.json(
          { error: 'Please select a JPG, PNG, or WEBP image under 5 MB.' },
          { status: 400 }
        );
      }

      const originalExt = path.extname(file.name || '').toLowerCase();
      extension = ALLOWED_EXTENSIONS.includes(originalExt) ? originalExt : '.jpg';
      fileBuffer = Buffer.from(await file.arrayBuffer());
    } else if (contentType.includes('application/json')) {
      const body = await req.json();

      // Check if this is an action to remove
      if (body.action === 'remove') {
        return handleRemovePhoto(session, req);
      }

      const { dataUrl, fileName } = body;
      if (!dataUrl || typeof dataUrl !== 'string') {
        return NextResponse.json({ error: 'Invalid or missing image data.' }, { status: 400 });
      }

      // Parse Data URL: data:image/jpeg;base64,...
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return NextResponse.json(
          { error: 'Please select a JPG, PNG, or WEBP image under 5 MB.' },
          { status: 400 }
        );
      }

      mimeType = matches[1].toLowerCase();
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return NextResponse.json(
          { error: 'Please select a JPG, PNG, or WEBP image under 5 MB.' },
          { status: 400 }
        );
      }

      const base64Data = matches[2];
      fileBuffer = Buffer.from(base64Data, 'base64');

      if (fileBuffer.length > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'Please select a JPG, PNG, or WEBP image under 5 MB.' },
          { status: 400 }
        );
      }

      const fileExt = fileName ? path.extname(fileName).toLowerCase() : '';
      if (ALLOWED_EXTENSIONS.includes(fileExt)) {
        extension = fileExt;
      } else {
        extension = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
      }
    } else {
      return NextResponse.json({ error: 'Unsupported request format.' }, { status: 415 });
    }

    // 3. Security validation: Verify image content
    if (!fileBuffer || !validateImageMagicBytes(fileBuffer)) {
      return NextResponse.json(
        { error: 'Please select a JPG, PNG, or WEBP image under 5 MB.' },
        { status: 400 }
      );
    }

    // 4. Save file to public/uploads/avatars/
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const timestamp = Date.now();
    // Sanitized filename strictly using session.id and timestamp
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `avatar-${sanitizedUserId}-${timestamp}${extension}`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, fileBuffer);

    // Public URL path with cache-busting timestamp version
    const avatarUrl = `/uploads/avatars/${filename}?v=${timestamp}`;

    // 5. Update user in Firestore/MemoryStore
    await updateUser(userId, { avatar: avatarUrl });

    // Safely sync to Prisma SQLite if User model exists
    try {
      await prisma.user.updateMany({
        where: { id: userId },
        data: { avatar: avatarUrl },
      });
    } catch (dbErr) {
      // Non-blocking if Prisma SQLite user record was not seeded
    }

    // 6. Refresh user session with new avatar
    const { iat, exp, ...cleanSession } = session as any;
    const updatedUserSession = {
      id: cleanSession.id,
      email: cleanSession.email,
      name: cleanSession.name,
      role: cleanSession.role,
      phone: cleanSession.phone,
      avatar: avatarUrl,
    };
    const newToken = signJwtToken(updatedUserSession);

    // Audit log event
    try {
      await recordSecurityEvent({
        eventType: 'COMMUTE_SYNC_TRIGGERED' as any,
        severity: 'LOW',
        actorUserId: userId,
        actorRole: session.role,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Next.js Client',
        resourceType: 'PROFILE',
        resourceId: userId,
        action: 'AVATAR_UPLOAD',
        result: 'SUCCESS',
        metadata: { filename, sizeBytes: fileBuffer.length },
      });
    } catch (e) {
      // Non-blocking audit logger
    }

    const response = NextResponse.json({
      success: true,
      avatarUrl,
      user: updatedUserSession,
      message: 'Profile photo updated successfully',
    });

    // Update JWT session cookie
    response.cookies.set('smartride_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('Profile photo upload error:', error);
    return NextResponse.json(
      { error: 'Unable to update profile photo. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile/photo
 * Removes the authenticated user's profile photo.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session || !session.id) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    return handleRemovePhoto(session, req);
  } catch (error: any) {
    console.error('Profile photo deletion error:', error);
    return NextResponse.json(
      { error: 'Unable to remove profile photo. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Helper to unset avatar and issue fresh token
 */
async function handleRemovePhoto(session: any, req: NextRequest) {
  const userId = session.id;

  // Unset avatar in Firestore/MemoryStore
  await updateUser(userId, { avatar: null });

  // Safely sync to Prisma SQLite
  try {
    await prisma.user.updateMany({
      where: { id: userId },
      data: { avatar: null },
    });
  } catch (dbErr) {
    // Non-blocking
  }

  // Refresh user session with null avatar
  const { iat, exp, ...cleanSession } = session as any;
  const updatedUserSession = {
    id: cleanSession.id,
    email: cleanSession.email,
    name: cleanSession.name,
    role: cleanSession.role,
    phone: cleanSession.phone,
    avatar: null,
  };
  const newToken = signJwtToken(updatedUserSession);

  // Audit log event
  try {
    await recordSecurityEvent({
      eventType: 'COMMUTE_SYNC_TRIGGERED' as any,
      severity: 'LOW',
      actorUserId: userId,
      actorRole: session.role,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'Next.js Client',
      resourceType: 'PROFILE',
      resourceId: userId,
      action: 'AVATAR_REMOVE',
      result: 'SUCCESS',
    });
  } catch (e) {
    // Non-blocking
  }

  const response = NextResponse.json({
    success: true,
    avatarUrl: null,
    user: updatedUserSession,
    message: 'Profile photo removed successfully',
  });

  response.cookies.set('smartride_token', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}
