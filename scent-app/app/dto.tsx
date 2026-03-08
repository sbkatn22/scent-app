import { FragranceForModal } from "@/components/fragrance-detail-modal";
import { useState } from "react";



export type Perfume = FragranceForModal & {
    id: number;
    name?: string;
    image_url?: string;
    score?: number;
    size?: string;
    added_on?: string;
    brand?: string;
  };
  const [collection, setCollection] = useState<Perfume[]>([]);
