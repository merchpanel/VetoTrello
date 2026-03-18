const TRELLO_BASE = "https://api.trello.com/1";

function apiKey(): string {
  const key = process.env.TRELLO_API_KEY;
  if (!key) throw new Error("TRELLO_API_KEY is not set");
  return key;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  idBoard: string;
}

export interface TrelloAttachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  bytes: number;
  date: string;
  isUpload: boolean;
}

export async function getCard(cardId: string, token: string): Promise<TrelloCard> {
  const url = `${TRELLO_BASE}/cards/${cardId}?key=${apiKey()}&token=${token}&fields=id,name,desc,idBoard`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Trello getCard failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<TrelloCard>;
}

export async function getAttachments(
  cardId: string,
  token: string
): Promise<TrelloAttachment[]> {
  const url = `${TRELLO_BASE}/cards/${cardId}/attachments?key=${apiKey()}&token=${token}&filter=true`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Trello getAttachments failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<TrelloAttachment[]>;
}

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function filterImageAttachments(attachments: TrelloAttachment[]): TrelloAttachment[] {
  return attachments
    .filter(
      (a) =>
        a.isUpload &&
        (IMAGE_MIME_TYPES.has(a.mimeType) ||
          /\.(jpe?g|png|webp|gif)$/i.test(a.name))
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function downloadAttachmentAsBase64(
  attachment: TrelloAttachment,
  token: string
): Promise<{ base64: string; mimeType: string }> {
  const maxBytes = (Number(process.env.MAX_IMAGE_SIZE_MB ?? 10)) * 1024 * 1024;

  if (attachment.bytes > maxBytes) {
    throw new Error(
      `Image is ${(attachment.bytes / 1024 / 1024).toFixed(1)} MB, which exceeds the ${process.env.MAX_IMAGE_SIZE_MB ?? 10} MB limit`
    );
  }

  // Trello requires auth header for attachment downloads
  const res = await fetch(attachment.url, {
    headers: {
      Authorization: `OAuth oauth_consumer_key="${apiKey()}", oauth_token="${token}"`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to download attachment (${res.status})`);
  }

  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = attachment.mimeType || "image/jpeg";

  return { base64, mimeType };
}

export async function postComment(
  cardId: string,
  token: string,
  text: string
): Promise<{ id: string }> {
  const url = `${TRELLO_BASE}/cards/${cardId}/actions/comments?key=${apiKey()}&token=${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Trello postComment failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { id: string };
  return { id: data.id };
}
