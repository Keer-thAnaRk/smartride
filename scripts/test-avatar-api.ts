import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { POST, DELETE } from '../src/app/api/profile/photo/route';
import { signJwtToken } from '../src/lib/auth';
import { getUserById } from '../src/lib/firestore-db';

async function runApiTests() {
  console.log('🧪 Starting Profile Photo API Route Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Unauthenticated Request Rejection
  console.log('1. Testing Authentication Enforcement:');
  const unauthReqPost = new NextRequest('http://localhost:3000/api/profile/photo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dataUrl: 'dummy' }),
  });
  const unauthResPost = await POST(unauthReqPost);
  assert(unauthResPost.status === 401, 'POST without auth returns 401 Unauthorized');

  const unauthReqDelete = new NextRequest('http://localhost:3000/api/profile/photo', {
    method: 'DELETE',
  });
  const unauthResDelete = await DELETE(unauthReqDelete);
  assert(unauthResDelete.status === 401, 'DELETE without auth returns 401 Unauthorized');

  // Authenticated Commuter Session
  const commuter = {
    id: 'uid_commuter_rahul_smartride_com',
    email: 'commuter.rahul@smartride.com',
    name: 'Rahul Verma',
    role: 'COMMUTER' as const,
    phone: '+91 98451 10001',
    avatar: null,
  };
  const token = signJwtToken(commuter);

  // 2. Reject Unsupported File / Corrupt Data
  console.log('\n2. Testing Validation & Rejections:');
  const invalidTypeReq = new NextRequest('http://localhost:3000/api/profile/photo', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `smartride_token=${token}`,
    },
    body: JSON.stringify({
      dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJ',
      fileName: 'document.pdf',
    }),
  });
  const invalidTypeRes = await POST(invalidTypeReq);
  assert(invalidTypeRes.status === 400, 'Rejects non-image MIME types with 400');
  const invalidTypeJson = await invalidTypeRes.json();
  assert(
    invalidTypeJson.error === 'Please select a JPG, PNG, or WEBP image under 5 MB.',
    'Returns exact friendly error message for invalid format'
  );

  // Reject oversized image
  const hugeBuffer = Buffer.alloc(6 * 1024 * 1024, 0xff); // 6 MB
  const oversizedDataUrl = `data:image/jpeg;base64,${hugeBuffer.toString('base64')}`;
  const oversizedReq = new NextRequest('http://localhost:3000/api/profile/photo', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `smartride_token=${token}`,
    },
    body: JSON.stringify({
      dataUrl: oversizedDataUrl,
      fileName: 'huge.jpg',
    }),
  });
  const oversizedRes = await POST(oversizedReq);
  assert(oversizedRes.status === 400, 'Rejects files over 5 MB with 400');

  // 3. Successful Image Upload
  console.log('\n3. Testing Successful Image Upload:');
  // Minimal valid 1x1 JPEG with valid magic bytes: FF D8 FF E0
  const validJpegBase64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const validDataUrl = `data:image/jpeg;base64,${validJpegBase64}`;

  const uploadReq = new NextRequest('http://localhost:3000/api/profile/photo', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `smartride_token=${token}`,
    },
    body: JSON.stringify({
      dataUrl: validDataUrl,
      fileName: 'commuter-avatar.jpg',
    }),
  });

  const uploadRes = await POST(uploadReq);
  assert(uploadRes.status === 200, 'Valid image upload succeeds with 200');

  const uploadJson = await uploadRes.json();
  assert(uploadJson.success === true, 'Response indicates success: true');
  assert(
    typeof uploadJson.avatarUrl === 'string' && uploadJson.avatarUrl.startsWith('/uploads/avatars/avatar-'),
    'Returns valid public avatar URL path'
  );
  assert(uploadJson.avatarUrl.includes('?v='), 'Avatar URL includes cache-busting version parameter');

  // Check file was actually written to public/uploads/avatars
  const cleanPath = uploadJson.avatarUrl.split('?')[0];
  const diskPath = path.join(process.cwd(), 'public', cleanPath);
  assert(fs.existsSync(diskPath), `Image file physically exists on disk at ${diskPath}`);

  // Check DB state
  const updatedUser = await getUserById(commuter.id);
  assert(updatedUser?.avatar === uploadJson.avatarUrl, 'User record in database reflects updated avatar URL');

  // Check updated session cookie was set
  const setCookie = uploadRes.headers.get('set-cookie');
  assert(setCookie !== null && setCookie.includes('smartride_token='), 'Response sets updated smartride_token cookie');

  // 4. Remove Profile Photo
  console.log('\n4. Testing Profile Photo Removal:');
  const deleteReq = new NextRequest('http://localhost:3000/api/profile/photo', {
    method: 'DELETE',
    headers: {
      cookie: `smartride_token=${token}`,
    },
  });

  const deleteRes = await DELETE(deleteReq);
  assert(deleteRes.status === 200, 'DELETE /api/profile/photo succeeds with 200');

  const deleteJson = await deleteRes.json();
  assert(deleteJson.success === true, 'Removal indicates success: true');
  assert(deleteJson.avatarUrl === null, 'Removal returns avatarUrl: null');

  const userAfterDelete = await getUserById(commuter.id);
  assert(userAfterDelete?.avatar === null, 'Database user record avatar is successfully reset to null');

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runApiTests().catch((err) => {
  console.error('API Test execution error:', err);
  process.exit(1);
});
