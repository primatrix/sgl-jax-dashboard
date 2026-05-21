import { type NextRequest } from "next/server";
import { handleCases } from "@/lib/api/cases-handler";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleCases(req.url);
}
