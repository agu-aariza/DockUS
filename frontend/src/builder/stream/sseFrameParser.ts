export interface ParsedSseFrame {
  eventName: string;
  data: string;
}

export function parseSseFrame(frame: string): ParsedSseFrame | null {
  if (!frame.trim()) return null;

  let eventName = "message";
  let data = "";
  frame.split(/\r?\n/).forEach((line) => {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    }
    if (line.startsWith("data:")) {
      data += line.slice("data:".length).trim();
    }
  });

  return data ? { eventName, data } : null;
}
