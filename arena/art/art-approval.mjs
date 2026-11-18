// Visual approval applies only to the reviewed v0.2.0 idle/walk and tile assets.
// The dated record pins the reviewed PNGs; tests verify those hashes after rebuild.
export const approvalRecord = 'arena/art/approval-v0.2.0.json';
export const contentVersion = 'arena-art-2026-11-18.four-head.3';
export const approvedActions = ['idle', 'walk'];
export const approvedMetadata = {
  status: 'approved',
  releaseApproved: true,
  approvalRecord,
  contentVersion,
};
