# Security Specification — 일당노트 (Personal Account Firestore Architecture)

## 1. Data Invariants
1. Every document across `/users/{userId}/private/profile`, `/users/{userId}/settings/preferences`, `/users/{userId}/jobs/{jobId}`, `/users/{userId}/shifts/{shiftId}`, `/users/{userId}/accountEntries/{entryId}`, and `/users/{userId}/salarySimulations/{simId}` is strictly isolated to `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. Every document stores `ownerId == request.auth.uid`, which is immutable on updates (`incoming().ownerId == existing().ownerId`).
3. Server timestamps (`createdAt == request.time` on create; `createdAt == existing().createdAt && updatedAt == request.time` on update) are strictly enforced.
4. All document IDs (`userId`, `jobId`, `shiftId`, `entryId`, `simId`) must pass `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
5. All strings enforce `.size()` bounds matching `firebase-blueprint.json`; all enums enforce static allowlists; all numeric fields enforce type and non-negative/bounded ranges.
6. Every `allow list` query rule enforces `existing().ownerId == request.auth.uid` on `resource.data`.
7. Default-deny catch-all `match /{document=**} { allow read, write: if false; }` sits at the top of the ruleset.

## 2. The "Dirty Dozen" Attack Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated read/write**: `request.auth == null` reading `/users/u1/shifts/s1`.
2. **Cross-tenant read**: User `u2` reading `/users/u1/private/profile` or `/users/u1/jobs/j1`.
3. **Cross-tenant list**: User `u2` listing `/users/u1/shifts` without matching `u1`.
4. **Identity spoofing on create**: User `u1` creating `/users/u1/jobs/j1` with `ownerId: "u2"`.
5. **Unverified email write**: Authenticated user with `email_verified: false` creating a shift.
6. **Shadow/Ghost field injection**: Creating a `JobProfile` with extra field `isAdmin: true`.
7. **Owner mutation on update**: Updating a `WorkShift` to change `ownerId` from `"u1"` to `"u2"`.
8. **Immutable timestamp tampering**: Updating `createdAt` or forging client `updatedAt != request.time`.
9. **ID poisoning**: Creating a document at `/users/u1/jobs/${"a".repeat(200)}` or with `/` / `$` characters.
10. **Oversized string DoS**: Writing a 5,000-character `memo` into `/users/u1/shifts/s1`.
11. **Invalid enum injection**: Writing `majorCategory: "무한대"` or `paymentStatus: "hacked"`.
12. **Negative financial poisoning**: Writing `amount: -50000` on `/users/u1/accountEntries/a1` or `annualSalary: -1`.
