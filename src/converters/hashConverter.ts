export async function convertToHash(
  file: File
): Promise<{ blob: Blob; filename: string }> {
  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  const buffer = await file.arrayBuffer();

  // Compute SHA-256 and SHA-1 using Web Crypto
  const sha256Buffer = await crypto.subtle.digest('SHA-256', buffer);
  const sha256Hash = bufferToHex(sha256Buffer);

  let sha1Hash = '';
  try {
    const sha1Buffer = await crypto.subtle.digest('SHA-1', buffer);
    sha1Hash = bufferToHex(sha1Buffer);
  } catch {
    sha1Hash = 'Não suportado';
  }

  const report = `================================================
RELATÓRIO DE INTEGRIDADE E CHECKSUM
================================================
Arquivo:         ${file.name}
Tamanho:         ${file.size.toLocaleString('pt-BR')} bytes (${(file.size / 1024).toFixed(2)} KB)
Tipo MIME:       ${file.type || 'Desconhecido'}
Data do Cálculo: ${new Date().toLocaleString('pt-BR')}

SHA-256:
${sha256Hash}

SHA-1:
${sha1Hash}
================================================
Gerado por Conversor Universal de Arquivos
`;

  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  return { blob, filename: `${baseName}_checksum.txt` };
}

export async function convertToBase64(
  file: File
): Promise<{ blob: Blob; filename: string }> {
  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  // FileReader is native and handles large files without building a huge string byte by byte
  let dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo para Base64.'));
    reader.readAsDataURL(file);
  });
  if (!file.type) {
    dataUri = dataUri.replace(/^data:[^;,]*/, 'data:application/octet-stream');
  }

  const blob = new Blob([dataUri], { type: 'text/plain;charset=utf-8' });
  return { blob, filename: `${baseName}_base64.txt` };
}

function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  const hexCodes = [...byteArray].map(value => {
    const hexCode = value.toString(16);
    return hexCode.padStart(2, '0');
  });
  return hexCodes.join('');
}
