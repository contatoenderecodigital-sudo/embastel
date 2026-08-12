import { NextRequest, NextResponse } from "next/server";
import { addNotice, listNotices } from "@/lib/noticesDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const notices = await listNotices();
  return NextResponse.json({ notices });
}

export async function POST(request: NextRequest) {
  const { text } = (await request.json()) as { text?: string };
  if (!text || !text.trim()) {
    return NextResponse.json(
      { error: "Informe o texto do aviso." },
      { status: 400 }
    );
  }
  const notice = await addNotice(text.trim());
  return NextResponse.json({ notice });
}
