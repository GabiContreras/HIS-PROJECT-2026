import { describe, expect, it } from 'vitest';
import { readSseMessages, type SseMessage } from '../sse';

function streamOf(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
      controller.close();
    },
  });
}

async function collect(chunks: (string | Uint8Array)[]): Promise<SseMessage[]> {
  const messages: SseMessage[] = [];
  for await (const message of readSseMessages(streamOf(chunks))) messages.push(message);
  return messages;
}

describe('readSseMessages', () => {
  it('lee un mensaje completo con data', async () => {
    expect(await collect(['data: {"a":1}\n\n'])).toEqual([{ event: 'message', data: '{"a":1}' }]);
  });

  it('une un mensaje partido entre varios chunks', async () => {
    const messages = await collect(['da', 'ta: {"camaId":"a', 'bc"}\n', '\nda', 'ta: 2\n\n']);

    expect(messages).toEqual([
      { event: 'message', data: '{"camaId":"abc"}' },
      { event: 'message', data: '2' },
    ]);
  });

  it('separa dos mensajes que llegan en el mismo chunk', async () => {
    const messages = await collect(['data: 1\n\ndata: 2\n\n']);

    expect(messages.map((m) => m.data)).toEqual(['1', '2']);
  });

  it('informa el nombre del evento, por ejemplo ping', async () => {
    const messages = await collect(['event: ping\ndata: {"at":"x"}\n\n']);

    expect(messages).toEqual([{ event: 'ping', data: '{"at":"x"}' }]);
  });

  it('concatena varias líneas data con salto de línea', async () => {
    expect(await collect(['data: uno\ndata: dos\n\n'])).toEqual([{ event: 'message', data: 'uno\ndos' }]);
  });

  it('ignora comentarios, campos id y retry', async () => {
    const messages = await collect([': latido\nid: 7\nretry: 1000\ndata: ok\n\n']);

    expect(messages).toEqual([{ event: 'message', data: 'ok' }]);
  });

  it('acepta terminadores CRLF, incluso cortados entre chunks', async () => {
    const messages = await collect(['data: a\r', '\n\r', '\ndata: b\r\n\r\n']);

    expect(messages.map((m) => m.data)).toEqual(['a', 'b']);
  });

  it('no emite un mensaje que quedó incompleto al cortarse la conexión', async () => {
    expect(await collect(['data: 1\n\ndata: 2'])).toEqual([{ event: 'message', data: '1' }]);
  });

  it('decodifica un carácter UTF-8 partido entre chunks', async () => {
    const bytes = new TextEncoder().encode('data: Sanación\n\n');
    const cut = bytes.indexOf(0xc3) + 1;

    const messages = await collect([bytes.slice(0, cut), bytes.slice(cut)]);

    expect(messages).toEqual([{ event: 'message', data: 'Sanación' }]);
  });
});
