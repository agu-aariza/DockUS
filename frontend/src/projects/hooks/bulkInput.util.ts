export async function readBulkInput(file: File | null): Promise<string | null> {
  if (!file) return null;
  const text = (await file.text()).trim();
  return text || null;
}

export function appendBulkInput(current: string, incoming: string): string {
  return current.trim() ? `${current.trim()}\n${incoming}` : incoming;
}
