// contexts/collection-context.tsx

import { createContext, useCallback, useContext, useState } from "react";
import { http } from "@/lib/http";

// Minimal type for collection/daily scent items shared across explore and modal
export type CollectionItem = {
  id: number;
  fragrance?: string;
  name?: string;
  image_url?: string;
  brand?: string;
  size?: string;
  added_on?: string;
  score?: number;
  [key: string]: unknown;
};

type CollectionContextValue = {
  collection: CollectionItem[];
  dailyScent: CollectionItem | null;
  setCollection: (items: CollectionItem[]) => void;
  setDailyScent: (item: CollectionItem | null) => void;
  refetchCollection: () => Promise<void>;
  refetchDailyScent: () => Promise<void>;
  toggleCollection: (perfumeId: number, size?: string) => Promise<void>;
  setTodayScent: (perfumeId: number | null) => Promise<void>;
};

const CollectionContext = createContext<CollectionContextValue | null>(null);

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [dailyScent, setDailyScent] = useState<CollectionItem | null>(null);

  const refetchCollection = useCallback(async () => {
    try {
      const { data } = await http.get("/api/user/me");
      setCollection(data.profile?.collection ?? []);
    } catch (err) {
      console.log("🟥 refetchCollection failed", err);
    }
  }, []);

  const refetchDailyScent = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const { data } = await http.get("/api/fragrances/daily_scent/get/", {
        params: { timestamp: now },
      });
      setDailyScent(data.daily_scent ?? null);
    } catch (err) {
      console.log("🟥 refetchDailyScent failed", err);
    }
  }, []);

  const toggleCollection = useCallback(
    async (perfumeId: number, size?: string) => {
      try {
        const body: { perfume_id: number; size?: string } = { perfume_id: perfumeId };
        if (size) body.size = size;
        await http.post("/api/fragrances/collection/toggle/", body);
        await refetchCollection();
      } catch (err) {
        console.log("🟥 toggleCollection failed", err);
      }
    },
    [refetchCollection]
  );

  const setTodayScent = useCallback(
    async (perfumeId: number | null) => {
      try {
        if (perfumeId !== null) {
          await http.post("/api/fragrances/daily_scent/create/", {
            perfume_id: perfumeId,
            timestamp: new Date().toISOString(),
          });
        }
        await refetchDailyScent();
        if (perfumeId === null) {
          setDailyScent(null);
        }
      } catch (err) {
        console.log("🟥 setTodayScent failed", err);
      }
    },
    [refetchDailyScent]
  );

  const value: CollectionContextValue = {
    collection,
    dailyScent,
    setCollection,
    setDailyScent,
    refetchCollection,
    refetchDailyScent,
    toggleCollection,
    setTodayScent,
  };

  return (
    <CollectionContext.Provider value={value}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  const ctx = useContext(CollectionContext);
  if (!ctx) {
    throw new Error("useCollection must be used within CollectionProvider");
  }
  return ctx;
}
