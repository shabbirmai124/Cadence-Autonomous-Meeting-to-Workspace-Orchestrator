# Security Specification — Cadence

## 1. Data Invariants
1. **Owner Isolation (PII & Workspace Privacy)**: Every `/users/{userId}` document contains PII (`email`) and may only be read or written by the verified owner (`request.auth.uid == userId`).
2. **Meeting Ownership**: Every `/meetings/{meetingId}` document must have `ownerId == request.auth.uid` on create and read/list/delete, and `ownerId` and `createdAt` are immutable after creation.
3. **Master Gate Subcollection Sync**: Every `/meetings/{meetingId}/actionItems/{itemId}` document requires parent meeting ownership (`getAfter` on create for atomic batch support, `get` on update/delete) and `ownerId == request.auth.uid`.
4. **Terminal State Locking**: Once a meeting transitions to `status == 'executed'`, subsequent client updates to the meeting or its action items are denied.
5. **Temporal Integrity & Strict Schema**: `createdAt` and `updatedAt` must equal `request.time`; unknown/ghost keys are rejected via `hasOnly` and `affectedKeys().hasOnly(...)`; all string lengths and IDs (`^[a-zA-Z0-9_\-]+$`, max 128) are bounded.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unverified Email Write**: Authenticated user with `email_verified == false` attempts to create `/meetings/m1`.
2. **Identity Spoofing on Create**: User `alice` attempts to create `/meetings/m1` with `ownerId: "bob"`.
3. **Shadow / Ghost Field Injection**: User `alice` creates `/meetings/m1` with an extra undeclared field `isAdmin: true`.
4. **Oversized ID Poisoning**: User creates `/meetings/` + 200-char ID or ID with `$` / `/`.
5. **Client Timestamp Tampering**: User creates `/meetings/m1` with `createdAt: "2020-01-01T00:00:00Z"` instead of server `request.time`.
6. **Direct Executed Status Shortcut**: User attempts to create `/meetings/m1` directly with `status: "executed"` instead of `"draft"`.
7. **Post-Execution Mutation (Terminal State Bypass)**: User attempts to update a meeting whose existing `status` is `'executed'`.
8. **Cross-Tenant Meeting Read / List**: User `bob` attempts `get` on `alice`'s meeting or `list` `/meetings` without `where('ownerId', '==', 'bob')`.
9. **Cross-Tenant PII Read**: User `bob` attempts `get` on `/users/alice`.
10. **Orphaned Action Item Create**: User `alice` creates `/meetings/nonexistent/actionItems/item1` without an existing or batched parent meeting.
11. **Value Poisoning on Update**: User updates `task` on an action item with a 10,000-character string or non-string boolean.
12. **Immutable Field Mutation**: User attempts to update `ownerId` or `createdAt` on an existing meeting or action item.
