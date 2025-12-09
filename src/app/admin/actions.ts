'use server';

import {promises as fs} from 'fs';
import path from 'path';

type Promotion = {
    id: string;
    title: string;
    type: 'text' | 'image';
    content: string;
    logoUrl?: string; 
    actionType: 'url' | 'popup' | 'enlarge';
    linkUrl?: string;
    popupContent?: string;
    status: 'active' | 'disabled';
    displayWeight: number;
    location: 'header' | 'sidebar' | 'both';
    createdAt?: {
        seconds: number;
        nanoseconds: number;
    };
}

export async function updatePromotions(promotions: Promotion[]) {
  const filePath = path.join(process.cwd(), 'src', 'lib', 'promotions.json');
  const jsonData = JSON.stringify({ promotions }, null, 2);
  
  try {
    await fs.writeFile(filePath, jsonData, 'utf8');
    return { success: true };
  } catch (error) {
    console.error("Failed to write to promotions.json", error);
    throw new Error("Failed to update promotions.");
  }
}

    