export const BED_BLOCKED = 'bed.blocked';
export const BED_UNBLOCKED = 'bed.unblocked';

export interface BedBlockedPayload {
  bedId: string;
  bedNumber: string;
  blockedAt: string;
}

export interface BedUnblockedPayload {
  bedId: string;
  bedNumber: string;
  unblockedAt: string;
}
