"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createDepartment(formData: FormData) {
  const name = formData.get('name') as string;
  const subdomain = formData.get('subdomain') as string;
  
  if (!name || !subdomain) {
    throw new Error('All fields are required.');
  }

  try {
    // Note: Your schema does not store a 'code' field on the Organization model, 
    // so we only pass 'name' and 'subdomain'.
    await prisma.organization.create({
      data: {
        name,
        subdomain: subdomain.toLowerCase().trim(),
      },
    });
    
    revalidatePath('/');
    return { success: true, message: `Department '${name}' successfully registered!` };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Subdomain already exists or database error.' };
  }
}