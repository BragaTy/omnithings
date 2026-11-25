// Video & audio conversion with Mediabunny (WebCodecs): runs locally, uses the
// browser's hardware encoders, no upload. Loaded lazily so the rest of the app
// doesn't pay for it.
import { getBaseName } from './textUtils';

export const VIDEO_TARGETS = ['mp4', 'webm', 'mkv', 'mov'] as const;
export const AUDIO_TARGETS = ['mp3', 'm4a', 'ogg', 'wav'] as const;

const MIME: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
};

let mp3Registered = false;

export async function convertMedia(
  file: File,
  targetFormat: string,
  onProgress?: (percent: number) => void
): Promise<{ blob: Blob; filename: string }> {
  const target = targetFormat.toLowerCase();
  if (!(target in MIME)) {
    throw new Error(`Conversão de mídia para ${target.toUpperCase()} não é suportada.`);
  }
  const audioOnly = (AUDIO_TARGETS as readonly string[]).includes(target);

  if (target !== 'wav' && typeof (window as any).AudioEncoder === 'undefined') {
    throw new Error('Seu navegador não tem os codificadores de mídia (WebCodecs). Use o Chrome, Edge ou Safari atualizados.');
  }

  const mb = await import('mediabunny');

  if (target === 'mp3' && !mp3Registered) {
    if (!(await mb.canEncodeAudio('mp3'))) {
      const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder');
      registerMp3Encoder();
    }
    mp3Registered = true;
  }

  const format =
    target === 'mp4' ? new mb.Mp4OutputFormat() :
    target === 'm4a' ? new mb.Mp4OutputFormat() :
    target === 'webm' ? new mb.WebMOutputFormat() :
    target === 'mkv' ? new mb.MkvOutputFormat() :
    target === 'mov' ? new mb.MovOutputFormat() :
    target === 'mp3' ? new mb.Mp3OutputFormat() :
    target === 'ogg' ? new mb.OggOutputFormat() :
    new mb.WavOutputFormat();

  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) });
  const target_ = new mb.BufferTarget();
  const output = new mb.Output({ format, target: target_ });

  let conversion: Awaited<ReturnType<typeof mb.Conversion.init>>;
  try {
    conversion = await mb.Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: audioOnly ? { discard: true } : undefined,
      audio: { quality: mb.QUALITY_HIGH },
    });
  } catch (e: any) {
    throw new Error(
      /unsupported|format|unknown/i.test(e?.message || '')
        ? 'Formato de arquivo não reconhecido. São suportados MP4, MOV, WebM, MKV, MP3, WAV, OGG, FLAC, AAC e TS.'
        : `Não foi possível abrir o arquivo: ${e?.message || 'erro desconhecido'}`
    );
  }

  if (!conversion.isValid) {
    const reasons = conversion.discardedTracks.map(d => d.reason);
    if (reasons.includes('no_encodable_target_codec')) {
      throw new Error(`Seu navegador não consegue gerar ${target.toUpperCase()} com o conteúdo deste arquivo. Tente MP4 ou WebM.`);
    }
    if (reasons.includes('undecodable_source_codec') || reasons.includes('unknown_source_codec')) {
      throw new Error('O codec deste arquivo não é suportado pelo navegador (ex.: HEVC/H.265 em alguns sistemas).');
    }
    throw new Error(audioOnly ? 'Este arquivo não tem faixa de áudio.' : 'Não há faixas de vídeo ou áudio utilizáveis neste arquivo.');
  }

  conversion.onProgress = p => onProgress?.(Math.round(40 + p * 58));
  await conversion.execute();

  const buffer = target_.buffer;
  if (!buffer) throw new Error('A conversão terminou sem gerar arquivo.');
  return {
    blob: new Blob([buffer], { type: MIME[target] }),
    filename: `${getBaseName(file.name)}.${target}`,
  };
}
