export type LineMessage = {
  id: string;
  date?: string;
  time?: string;
  sender?: string;
  content: string;
};

export type ParseResult = {
  partnerName: string;
  messages: LineMessage[];
};

/**
 * Parse LINE chat history text file content
 * @param text Raw text content of the chat history file
 * @returns Parsed partner name and messages
 */
export const parseLineChatHistory = (text: string): ParseResult => {
  const lines = text.split("\n");
  const header = lines.find((l) => l.includes("とのトーク履歴")) || "";
  const m = header.match(/\[LINE\]?\s*(.+?)とのトーク履歴/);

  const partnerName = m ? m[1].trim() : "";

  const messages: LineMessage[] = [];
  let currentDate = "";

  for (let raw of lines) {
    raw = raw.trim();
    if (!raw) continue;

    // Date line (e.g., 2023/01/01)
    if (/^\d{4}\/\d{2}\/\d{2}/.test(raw)) {
      currentDate = raw;
      messages.push({ id: crypto.randomUUID(), date: currentDate, content: "" });
      continue;
    }

    // Message line (Time <tab> Sender <tab> Content)
    const parts = raw.split("\t");
    if (parts.length >= 3) {
      const [time, sender, ...rest] = parts;
      messages.push({
        id: crypto.randomUUID(),
        date: currentDate,
        time,
        sender,
        content: rest.join("\t"),
      });
    }
  }

  return { partnerName, messages };
};
