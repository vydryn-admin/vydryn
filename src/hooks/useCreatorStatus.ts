import { useState, useCallback } from 'react';

const KEY = 'vydryn_creator_v1';

interface CreatorRecord {
  active: boolean;
  activatedAt: number;   // timestamp
  expiresAt: number;     // timestamp (30 days for now; real expiry comes from Stripe webhook)
}

function load(): CreatorRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as CreatorRecord;
    // Expired?
    if (rec.expiresAt && Date.now() > rec.expiresAt) {
      localStorage.removeItem(KEY);
      return null;
    }
    return rec;
  } catch {
    return null;
  }
}

export function useCreatorStatus() {
  const [record, setRecord] = useState<CreatorRecord | null>(load);

  const isCreator = record?.active === true;

  const activate = useCallback(() => {
    const rec: CreatorRecord = {
      active: true,
      activatedAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };
    localStorage.setItem(KEY, JSON.stringify(rec));
    setRecord(rec);
  }, []);

  const deactivate = useCallback(() => {
    localStorage.removeItem(KEY);
    setRecord(null);
  }, []);

  return { isCreator, activate, deactivate };
}
