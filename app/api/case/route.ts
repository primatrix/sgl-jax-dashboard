import { type NextRequest } from "next/server";
import { handleCase } from "@/lib/api/case-handler";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleCase(req.url);
}
