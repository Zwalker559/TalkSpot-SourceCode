'use server';

import {promises as fs} from 'fs';
import path from 'path';

export async function updatePromotions(jsonContent: string) {
  const filePath = path.join(process.cwd(), 'src', 'lib', 'promotions.json');
  
  try {
    // Validate if the content is valid JSON before writing
    JSON.parse(jsonContent);
    await fs.writeFile(filePath, jsonContent, 'utf8');
    return { success: true, message: 'Promotions updated successfully. The app will now reload.' };
  } catch (error: any) {
    console.error("Failed to write to promotions.json", error);
    // If JSON is invalid, the error message will be informative
    return { success: false, message: `Failed to update promotions: ${error.message}` };
  }
}
