import { jsonStore } from "./jsonStore";

export type Notice = {
  id: string;
  text: string;
  createdAt: number;
};

type NoticesData = {
  notices: Notice[];
};

const store = jsonStore<NoticesData>("avisos.json", { notices: [] });

export async function listNotices(): Promise<Notice[]> {
  const data = await store.read();
  return [...data.notices].sort((a, b) => b.createdAt - a.createdAt);
}

export async function addNotice(text: string): Promise<Notice> {
  return store.update((data) => {
    const notice: Notice = {
      id: `aviso-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      createdAt: Date.now(),
    };
    data.notices.push(notice);
    return notice;
  });
}

export async function removeNotice(id: string): Promise<void> {
  await store.update((data) => {
    data.notices = data.notices.filter((n) => n.id !== id);
  });
}
