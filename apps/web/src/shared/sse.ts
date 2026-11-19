export interface SseMessage {
  event: string;
  data: string;
}

export async function* readSseMessages(body: ReadableStream<Uint8Array>): AsyncGenerator<SseMessage> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let event = '';
  let data: string[] = [];

  function consumeLine(line: string): SseMessage | null {
    if (line === '') {
      const message = data.length > 0 ? { event: event || 'message', data: data.join('\n') } : null;
      event = '';
      data = [];
      return message;
    }
    if (line.startsWith(':')) return null;
    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? '' : line.slice(separator + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
    return null;
  }

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split(/\r\n|\n|\r(?!$)/);
      pending = lines.pop() ?? '';
      for (const line of lines) {
        const message = consumeLine(line);
        if (message) yield message;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
