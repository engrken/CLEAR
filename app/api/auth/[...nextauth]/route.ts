// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth"; // Imports from the root auth.ts

export const { GET, POST } = handlers;