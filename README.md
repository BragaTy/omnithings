# OmniThings

<p align="center">
  <a href="https://bragaty.github.io/omniconvert/" target="_blank">
    <img src="https://img.shields.io/badge/Acessar%20Online-https%3A%2F%2Fbragaty.github.io%2Fomniconvert%2F-success?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Acessar Online" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-100%25%20Funcional-emerald?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Licen%C3%A7a-MIT-blue?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/Deploy-GitHub%20Pages-purple?style=for-the-badge" alt="GitHub Pages" />
  <img src="https://img.shields.io/badge/Privacidade-Zero%20Servidor-orange?style=for-the-badge" alt="Privacidade" />
</p>

> **Finanças pessoais, conversores e utilitários que rodam 100% no seu navegador.**
>
> 🌐 [https://bragaty.github.io/omniconvert/](https://bragaty.github.io/omniconvert/)

## O que tem

- **Finanças**: importe extratos (CSV, OFX, Excel) e faturas de cartão dos bancos brasileiros e veja gastos por categoria, metas mensais, entradas × saídas por mês e as contas fixas e assinaturas detectadas automaticamente. Os dados ficam só no `localStorage` do navegador.
- **Converter**: imagens, documentos (DOCX → PDF mantém as imagens), planilhas, dados, **vídeo** (MP4, WebM, MKV, MOV) e **áudio** (MP3, M4A, OGG, WAV) via WebCodecs.
- **Ferramentas PDF** e **Vídeo e áudio**: juntar, dividir, comprimir, cortar, gravar tela etc.
- **Utilitários** (31 ferramentas):
  - *Documentos e dados de teste*: gerar e validar CPF, CNPJ, RG, CNH, PIS/PASEP, RENAVAM, título de eleitor, inscrição estadual (SP, RJ, PR, RS), CEP e placa; pessoa e empresa fictícias; cartão de crédito de teste (Luhn); conta bancária de teste (BB, Itaú, Bradesco).
  - *Gerar*: senha, QR Code Pix, nicks, links de WhatsApp/Telegram, Lorem Ipsum, sorteador.
  - *Texto*: letras diferentes, símbolos, contador e maiúsculas, número por extenso, ordem alfabética, ocorrência de palavras, dividir/juntar/cortar, inverter, remover HTML, texto para HTML, cifra de César, hash MD5/SHA.
  - *Matemática*: porcentagem, regra de três, datas e dias úteis (com feriados nacionais), áreas, MDC/MMC/fatoração, números romanos.
  - *Converter*: unidades de medida e bases numéricas.

---

## 🎯 Por que roda no navegador?

A maioria dos conversores online (Convertio, iLovePDF, CloudConvert) envia seus documentos e vídeos para servidores remotos, com limites de 2 arquivos por dia, filas de espera e planos pagos.

O **OmniThings** faz o processamento **diretamente na memória RAM do seu dispositivo** via **WebAssembly**, **HTML5 Canvas**, **pdf-lib** e **Web Audio API**:
- 🔒 **Privacidade Absoluta**: Seus dados nunca saem da sua máquina.
- ⚡ **Sem Fila nem Limites**: Converta quantos arquivos quiser sem gastar créditos.
- 🗜️ **Download em Lote (.ZIP)**: Converta dezenas de arquivos e baixe tudo empacotado com 1 clique.
- 🌐 **Pronto para GitHub Pages**: Funciona como aplicação estática sem precisar de backend!

---

## ✨ Recursos e Módulos

### 🔄 1. Conversor Universal de Arquivos
- **🖼️ Imagens**: PNG, JPG/JPEG, WEBP, BMP, ICO (favicons multi-tamanho), SVG, PDF, Base64 Data URI.
- **📊 Planilhas & Dados**: CSV, Excel (XLSX/XLS), JSON, YAML, XML, TSV, HTML (Tabela estilizada), TXT.
- **📄 Documentos**: Markdown (.md), HTML, TXT, PDF com paginação automática.
- **🗜️ Compactação & Checksum**: Empacotamento em ZIP, extração e relatórios de hash criptográfico (SHA-256 / SHA-1).
- **📋 Suporte a `Ctrl + V`**: Cole prints de tela diretamente da área de transferência.

---

### 📑 2. Suite Completa de Ferramentas PDF (Estilo iLovePDF)

| Categoria | Ferramentas Inclusas |
| :--- | :--- |
| **Organizar & Editar** | Juntar PDF, Dividir PDF, Organizar Páginas, Rodar PDF (90°/180°/270°), Recortar Margens, Editar PDF, Ocultar/Tarjar Informações Sensíveis, Adicionar Números de Página, Criar Formulários Interativos. |
| **Converter de PDF** | PDF para Word (.docx), PDF para PowerPoint, PDF para Excel (.xlsx), PDF para JPG, PDF para Markdown (.md), PDF para PDF/A (ISO arquivístico), Extrair Texto do PDF (TXT). |
| **Converter para PDF** | Word para PDF, PowerPoint para PDF, Excel para PDF, JPG para PDF, HTML para PDF, Digitalizar Câmera para PDF. |
| **Otimizar & Segurança** | Comprimir PDF, Proteger com Senha, Desbloquear PDF, Reparar Estrutura Corrompida (XREF), Assinar Documento Digitalmente, Comparar Diferenças entre 2 PDFs. |

---

### 🎬 3. Estúdio de Vídeo & Áudio
- 🔇 **Remover Áudio de Vídeos**: Gera uma versão silenciosa de vídeos MP4/WebM sem perder qualidade.
- 🎵 **Extrair Áudio de Vídeos**: Retira a trilha sonora de vídeos e exporta em áudio de estúdio WAV / MP3.
- ✂️ **Cortar Vídeo & Áudio (Trim)**: Defina início e fim em segundos para aparar trechos específicos.
- 🎛️ **Juntar Múltiplos Áudios**: Concatene faixas de áudio em uma única música contínua.
- 🔴 **Gravador de Tela do Computador**: Grave sua tela, janela ou aba do navegador sem instalar programas extras.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS v4](https://tailwindcss.com/)
- **Build Tool**: [Vite](https://vite.dev/)
- **Manipulação PDF**: `pdf-lib`, `pdfjs-dist`, `jspdf`, `docx`
- **Planilhas & Dados**: `xlsx` (SheetJS), `js-yaml`, `marked`
- **Áudio & Vídeo**: Web Audio API, Canvas CaptureStream, MediaRecorder
- **Ícones**: [Lucide React](https://lucide.dev/)

---

## 🚀 Como Rodar Localmente

1. Clone o repositório:
```bash
git clone https://github.com/bragaty/omniconvert.git
cd omniconvert
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor:
```bash
npm run dev
```
Abra seu navegador em `http://localhost:5173`.

---


## 📄 Licença
Distribuído sob a licença MIT. Veja `LICENSE` para mais detalhes.