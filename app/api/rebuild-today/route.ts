import { type NextRequest } from "next/server";
import { handleRebuildToday } from "@/lib/api/rebuild-today-handler";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handleRebuildToday(req);
}
