import { signJwtToken, verifyJwtToken } from '../src/lib/auth';
import { getInitials } from '../src/components/ui/UserAvatar';
import { getUserById, updateUser } from '../src/lib/firestore-db';

async function runTests() {
  console.log('🧪 Starting SmartRide Profile Photo Unit & Logic Verification...\n');
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

  // 1. Test getInitials helper
  console.log('1. Testing Initials Fallback Generator:');
  assert(getInitials('Gayathri') === 'G', 'Single name "Gayathri" yields "G"');
  assert(getInitials('Rahul Kumar') === 'RK', 'Two names "Rahul Kumar" yields "RK"');
  assert(getInitials('Rajesh') === 'R', 'Single name "Rajesh" yields "R"');
  assert(getInitials('Elena Rostova') === 'ER', 'Two names "Elena Rostova" yields "ER"');
  assert(getInitials('Amit Kumar Patel') === 'AP', 'Three names "Amit Kumar Patel" yields first and last "AP"');
  assert(getInitials('') === 'U', 'Empty string yields "U"');
  assert(getInitials(null) === 'U', 'Null yields "U"');
  assert(getInitials(undefined) === 'U', 'Undefined yields "U"');

  // 2. Test JWT session token signing and verification with avatar
  console.log('\n2. Testing JWT Session Token Handling:');
  const commuterA = {
    id: 'uid_commuter_rahul_smartride_com',
    email: 'commuter.rahul@smartride.com',
    name: 'Rahul Verma',
    role: 'COMMUTER' as const,
    phone: '+91 98451 10001',
    avatar: '/uploads/avatars/avatar-test.jpg',
  };

  const tokenA = signJwtToken(commuterA);
  const verifiedA = verifyJwtToken(tokenA);
  assert(verifiedA !== null, 'Token verified successfully');
  assert(verifiedA?.id === commuterA.id, 'Token retains correct userId');
  assert(verifiedA?.avatar === commuterA.avatar, 'Token retains correct avatar URL');

  // Token after avatar removal
  const commuterARemoved = {
    ...commuterA,
    avatar: null,
  };
  const tokenRemoved = signJwtToken(commuterARemoved);
  const verifiedRemoved = verifyJwtToken(tokenRemoved);
  assert(verifiedRemoved?.avatar === null, 'Token correctly sets avatar to null upon removal');

  // 3. Test Database Avatar State Persistence and Cross-User Isolation
  console.log('\n3. Testing Database State & User Isolation:');
  const commuterBId = 'uid_commuter_priya_smartride_com';

  // Seed / set initial state
  await updateUser(commuterA.id, { avatar: '/uploads/avatars/initial_rahul.jpg' });
  await updateUser(commuterBId, { avatar: '/uploads/avatars/initial_priya.jpg' });

  let userA = await getUserById(commuterA.id);
  let userB = await getUserById(commuterBId);
  assert(userA?.avatar === '/uploads/avatars/initial_rahul.jpg', 'User A initial avatar set');
  assert(userB?.avatar === '/uploads/avatars/initial_priya.jpg', 'User B initial avatar set');

  // Update User A's avatar
  const newAvatarA = '/uploads/avatars/avatar-rahul-123456.jpg?v=123456';
  await updateUser(commuterA.id, { avatar: newAvatarA });

  userA = await getUserById(commuterA.id);
  userB = await getUserById(commuterBId);
  assert(userA?.avatar === newAvatarA, 'User A avatar updated successfully');
  assert(userB?.avatar === '/uploads/avatars/initial_priya.jpg', 'User B avatar remained completely untouched (Isolation guaranteed)');

  // Remove User A's avatar
  await updateUser(commuterA.id, { avatar: null });
  userA = await getUserById(commuterA.id);
  assert(userA?.avatar === null, 'User A avatar removed successfully in database');
  assert(userB?.avatar === '/uploads/avatars/initial_priya.jpg', 'User B avatar still untouched after User A removal');

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
