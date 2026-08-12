import { NextRequest, NextResponse } from "next/server";
import { getSettings, setAiAutoReplyEnabled } from "@/lib/settingsDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
  const { aiAutoReplyEnabled } = (await request.json()) as {
    aiAutoReplyEnabled?: boolean;
  };
  const settings = await setAiAutoReplyEnabled(Boolean(aiAutoReplyEnabled));
  return NextResponse.json(settings);
}
