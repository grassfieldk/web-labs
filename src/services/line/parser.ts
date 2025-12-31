export type LineMessage = {
  id: string;
  date?: string;
  time?: string;
  sender?: string;
  content: string;
};

export type ParseResult = {
  partnerName: string;
  history: Array<{
    year: number;
    month: number; // 1-based
    messages: LineMessage[];
  }>;
};

/**
 * Normalize newlines in text (CRLF and CR to LF)
 */
function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Extract year and month from date string (format: YYYY/MM/DD)
 */
export function yearMonthFromDate(date: string): { year: number; month: number } | null {
  const m = date.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

/**
 * Extract year from date string (format: YYYY/MM/DD)
 */
export function yearFromDate(date: string): number | null {
  const m = date.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (!m) return null;
  return Number(m[1]);
}

/**
 * Parse LINE chat history text file content
 * @param text Raw text content of the chat history file
 * @returns Parsed partner name and history grouped by year/month
 */
export const parseLineChatHistory = (text: string): ParseResult => {
  const normalized = normalizeNewlines(text);
  const lines = normalized.split("\n");
  const header = lines.find((l) => l.includes("とのトーク履歴")) || "";
  const m = header.match(/\[LINE\]?\s*(.+?)とのトーク履歴/);

  const partnerName = m ? m[1].trim() : "";

  // Group messages by year and month
  const historyMap = new Map<
    string,
    { year: number; month: number; messages: LineMessage[] }
  >();
  let currentDate = "";
  let lastMessage: LineMessage | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    // Date line (e.g., 2023/01/01)
    if (/^\d{4}\/\d{2}\/\d{2}/.test(line.trim())) {
      currentDate = line.trim().slice(0, 10);
      lastMessage = null;
      continue;
    }

    // Message line (Time <tab> Sender <tab> Content)
    const parts = line.split("\t");
    if (parts.length >= 3 && currentDate) {
      const [time, sender, ...rest] = parts;
      const msg: LineMessage = {
        id: crypto.randomUUID(),
        date: currentDate,
        time,
        sender,
        content: rest.join("\t"),
      };

      // Group by year/month
      const ym = yearMonthFromDate(currentDate);
      if (ym) {
        const key = `${ym.year}-${String(ym.month).padStart(2, "0")}`;
        if (!historyMap.has(key)) {
          historyMap.set(key, { year: ym.year, month: ym.month, messages: [] });
        }
        historyMap.get(key)!.messages.push(msg);
      }

      lastMessage = msg;
      continue;
    }

    // Multi-line message continuation
    if (lastMessage) {
      lastMessage.content = `${lastMessage.content}\n${line.trim()}`;
    }
  }

  // Sort by year (desc) and month (desc)
  const history = Array.from(historyMap.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  return { partnerName, history };
};
