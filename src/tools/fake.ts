// Fictitious people and companies for filling forms and test databases.
import { randomInt, generateCpf, generateRg, generateCnpj, generateCep, generateIe, IE_STATES, IeState, generatePis, generateCnh, generateTitulo } from './documents';

const pick = <T,>(arr: readonly T[]): T => arr[randomInt(0, arr.length - 1)];

const FIRST_F = ['Ana', 'Maria', 'Juliana', 'Fernanda', 'Camila', 'Beatriz', 'Larissa', 'Mariana', 'Patrícia', 'Aline', 'Gabriela', 'Letícia', 'Rafaela', 'Bruna', 'Carolina', 'Isabela', 'Luana', 'Vanessa', 'Natália', 'Helena', 'Alice', 'Sofia', 'Valentina', 'Laura', 'Manuela'];
const FIRST_M = ['João', 'Pedro', 'Lucas', 'Gabriel', 'Matheus', 'Rafael', 'Felipe', 'Gustavo', 'Bruno', 'Thiago', 'Carlos', 'Eduardo', 'Rodrigo', 'Vinícius', 'Leonardo', 'André', 'Daniel', 'Marcelo', 'Ricardo', 'Diego', 'Arthur', 'Heitor', 'Bernardo', 'Davi', 'Miguel'];
const SURNAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado', 'Mendes', 'Freitas', 'Cardoso', 'Ramos', 'Teixeira', 'Araújo', 'Pinto'];
const STREET_TYPES = ['Rua', 'Avenida', 'Travessa', 'Alameda'];
const STREET_NAMES = ['das Flores', 'São João', 'XV de Novembro', 'Sete de Setembro', 'Tiradentes', 'Santos Dumont', 'Brasil', 'Paulista', 'das Palmeiras', 'Rio Branco', 'Dom Pedro II', 'Getúlio Vargas', 'Marechal Deodoro', 'dos Andradas', 'Vinte e Um de Abril', 'da Consolação', 'Barão de Mauá', 'das Acácias'];
const NEIGHBORHOODS = ['Centro', 'Jardim América', 'Vila Nova', 'Boa Vista', 'Santa Cecília', 'Bela Vista', 'Jardim Paulista', 'Vila Mariana', 'Planalto', 'Industrial', 'São José', 'Parque das Nações'];
const CITIES: { city: string; uf: string; ddd: string }[] = [
  { city: 'São Paulo', uf: 'SP', ddd: '11' }, { city: 'Campinas', uf: 'SP', ddd: '19' }, { city: 'Rio de Janeiro', uf: 'RJ', ddd: '21' },
  { city: 'Niterói', uf: 'RJ', ddd: '21' }, { city: 'Belo Horizonte', uf: 'MG', ddd: '31' }, { city: 'Uberlândia', uf: 'MG', ddd: '34' },
  { city: 'Curitiba', uf: 'PR', ddd: '41' }, { city: 'Londrina', uf: 'PR', ddd: '43' }, { city: 'Porto Alegre', uf: 'RS', ddd: '51' },
  { city: 'Florianópolis', uf: 'SC', ddd: '48' }, { city: 'Salvador', uf: 'BA', ddd: '71' }, { city: 'Recife', uf: 'PE', ddd: '81' },
  { city: 'Fortaleza', uf: 'CE', ddd: '85' }, { city: 'Brasília', uf: 'DF', ddd: '61' }, { city: 'Goiânia', uf: 'GO', ddd: '62' },
  { city: 'Manaus', uf: 'AM', ddd: '92' }, { city: 'Belém', uf: 'PA', ddd: '91' }, { city: 'Vitória', uf: 'ES', ddd: '27' },
];
const EMAIL_DOMAINS = ['email.com', 'exemplo.com.br', 'teste.com', 'mail.com.br'];
const BLOOD = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const SIGNS: [string, number, number][] = [
  ['Capricórnio', 1222, 1231], ['Capricórnio', 101, 119], ['Aquário', 120, 218], ['Peixes', 219, 320], ['Áries', 321, 419],
  ['Touro', 420, 520], ['Gêmeos', 521, 620], ['Câncer', 621, 722], ['Leão', 723, 822], ['Virgem', 823, 922],
  ['Libra', 923, 1022], ['Escorpião', 1023, 1121], ['Sagitário', 1122, 1221],
];

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const pad = (n: number) => String(n).padStart(2, '0');

function fullName(sex: 'F' | 'M'): string {
  const first = sex === 'F' ? pick(FIRST_F) : pick(FIRST_M);
  const s1 = pick(SURNAMES);
  let s2 = pick(SURNAMES);
  while (s2 === s1) s2 = pick(SURNAMES);
  return `${first} ${s1} ${s2}`;
}

function phone(ddd: string, mobile: boolean): string {
  const n = mobile
    ? `9${randomInt(6, 9)}${randomInt(100, 999)}-${String(randomInt(0, 9999)).padStart(4, '0')}`
    : `${randomInt(2, 5)}${randomInt(100, 999)}-${String(randomInt(0, 9999)).padStart(4, '0')}`;
  return `(${ddd}) ${n}`;
}

function address(place: { city: string; uf: string }) {
  return {
    cep: generateCep(place.uf),
    logradouro: `${pick(STREET_TYPES)} ${pick(STREET_NAMES)}`,
    numero: String(randomInt(1, 3500)),
    bairro: pick(NEIGHBORHOODS),
    cidade: place.city,
    estado: place.uf,
  };
}

export interface Person {
  nome: string;
  sexo: string;
  idade: number;
  dataNascimento: string;
  signo: string;
  mae: string;
  pai: string;
  cpf: string;
  rg: string;
  cnh: string;
  pis: string;
  tituloEleitor: string;
  email: string;
  senha: string;
  celular: string;
  telefone: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  altura: string;
  peso: string;
  tipoSanguineo: string;
}

export function generatePerson(opts: { sex?: 'F' | 'M' | 'any'; minAge?: number; maxAge?: number; uf?: string } = {}): Person {
  const sex = !opts.sex || opts.sex === 'any' ? (randomInt(0, 1) ? 'F' : 'M') : opts.sex;
  const name = fullName(sex);
  const age = randomInt(opts.minAge ?? 18, opts.maxAge ?? 70);
  const today = new Date();
  const birth = new Date(today.getFullYear() - age, randomInt(0, 11), 1);
  birth.setDate(randomInt(1, 28));
  if (birth > new Date(today.getFullYear() - age, today.getMonth(), today.getDate())) birth.setFullYear(birth.getFullYear() - 1);
  const md = (birth.getMonth() + 1) * 100 + birth.getDate();
  const sign = SIGNS.find(([, a, b]) => md >= a && md <= b)?.[0] || 'Capricórnio';
  const places = opts.uf ? CITIES.filter(c => c.uf === opts.uf) : CITIES;
  const place = pick(places.length ? places : CITIES);
  const addr = address(place);
  const [first, , last] = name.split(' ');
  const height = sex === 'F' ? randomInt(150, 180) : randomInt(160, 195);
  const realAge = today.getFullYear() - birth.getFullYear() - (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);

  return {
    nome: name,
    sexo: sex === 'F' ? 'Feminino' : 'Masculino',
    idade: realAge,
    dataNascimento: `${pad(birth.getDate())}/${pad(birth.getMonth() + 1)}/${birth.getFullYear()}`,
    signo: sign,
    mae: `${pick(FIRST_F)} ${pick(SURNAMES)} ${last}`,
    pai: `${pick(FIRST_M)} ${name.split(' ')[1]} ${last}`,
    cpf: generateCpf(),
    rg: generateRg(),
    cnh: generateCnh(),
    pis: generatePis(),
    tituloEleitor: generateTitulo(place.uf),
    email: `${slug(first)}.${slug(last)}${randomInt(1, 99)}@${pick(EMAIL_DOMAINS)}`,
    senha: Array.from({ length: 10 }, () => 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(0, 54)]).join(''),
    celular: phone(place.ddd, true),
    telefone: phone(place.ddd, false),
    cep: addr.cep,
    endereco: addr.logradouro,
    numero: addr.numero,
    bairro: addr.bairro,
    cidade: addr.cidade,
    estado: addr.estado,
    altura: `${(height / 100).toFixed(2).replace('.', ',')} m`,
    peso: `${Math.round(height * (sex === 'F' ? 0.36 : 0.42) + randomInt(-12, 18))} kg`,
    tipoSanguineo: pick(BLOOD),
  };
}

const COMPANY_WORDS = ['Alfa', 'Horizonte', 'Nova Era', 'Prime', 'Vértice', 'Atlas', 'Aurora', 'Pioneira', 'Global', 'Sol Nascente', 'Bandeirantes', 'Litoral', 'Serra Azul', 'Conecta', 'Vitória', 'Ponto Certo', 'Integra', 'Viva'];
const COMPANY_AREAS = ['Tecnologia', 'Comércio de Alimentos', 'Serviços Contábeis', 'Engenharia', 'Logística', 'Consultoria', 'Distribuidora', 'Construções', 'Transportes', 'Comunicação', 'Saúde', 'Educação', 'Materiais Elétricos', 'Móveis', 'Turismo'];
const COMPANY_TYPES = ['Ltda.', 'S.A.', 'ME', 'EIRELI', 'Ltda. - EPP'];

export interface Company {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  dataAbertura: string;
  site: string;
  email: string;
  telefone: string;
  celular: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export function generateCompany(uf?: string): Company {
  const places = uf ? CITIES.filter(c => c.uf === uf) : CITIES;
  const place = pick(places.length ? places : CITIES);
  const word = pick(COMPANY_WORDS);
  const area = pick(COMPANY_AREAS);
  const fantasia = `${word} ${area.split(' ')[0]}`;
  const domain = `${slug(word)}${slug(area.split(' ')[0])}.com.br`;
  const addr = address(place);
  const opened = new Date(randomInt(1990, new Date().getFullYear() - 1), randomInt(0, 11), randomInt(1, 28));
  const ieState = (IE_STATES as readonly string[]).includes(place.uf) ? (place.uf as IeState) : null;
  return {
    razaoSocial: `${word} ${area} ${pick(COMPANY_TYPES)}`,
    nomeFantasia: fantasia,
    cnpj: generateCnpj(),
    inscricaoEstadual: ieState ? generateIe(ieState) : 'Isento',
    dataAbertura: `${pad(opened.getDate())}/${pad(opened.getMonth() + 1)}/${opened.getFullYear()}`,
    site: `www.${domain}`,
    email: `contato@${domain}`,
    telefone: phone(place.ddd, false),
    celular: phone(place.ddd, true),
    cep: addr.cep,
    endereco: addr.logradouro,
    numero: addr.numero,
    bairro: addr.bairro,
    cidade: addr.cidade,
    estado: addr.estado,
  };
}

export const PERSON_STATES = Array.from(new Set(CITIES.map(c => c.uf))).sort();

// ------------------------------------------------------------------ Lorem ipsum
const LOREM = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum'.split(' ');

function sentence(): string {
  const n = randomInt(6, 14);
  const words = Array.from({ length: n }, () => pick(LOREM));
  const s = words.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

export function lorem(kind: 'paragraphs' | 'sentences' | 'words', count: number, startWithLorem = true): string {
  const n = Math.max(1, Math.min(100, Math.floor(count) || 1));
  let out: string;
  if (kind === 'words') {
    out = Array.from({ length: n }, () => pick(LOREM)).join(' ');
  } else if (kind === 'sentences') {
    out = Array.from({ length: n }, sentence).join(' ');
  } else {
    out = Array.from({ length: n }, () => Array.from({ length: randomInt(4, 7) }, sentence).join(' ')).join('\n\n');
  }
  if (startWithLorem) {
    const start = kind === 'words' ? 'lorem ipsum dolor sit amet' : 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
    out = kind === 'words'
      ? [...start.split(' '), ...out.split(' ')].slice(0, Math.max(n, 1)).join(' ')
      : `${start} ${out}`;
  }
  return out;
}

// ------------------------------------------------------------------ random numbers / draw
export function drawNumbers(min: number, max: number, count: number, unique: boolean): number[] {
  if (!isFinite(min) || !isFinite(max) || max < min) throw new Error('O maior número precisa ser maior que o menor.');
  const range = max - min + 1;
  const n = Math.max(1, Math.min(1000, Math.floor(count)));
  if (unique && n > range) throw new Error(`Só existem ${range} números nesse intervalo.`);
  if (!unique) return Array.from({ length: n }, () => randomInt(min, max));
  const chosen = new Set<number>();
  while (chosen.size < n) chosen.add(randomInt(min, max));
  return Array.from(chosen);
}

export function drawItems(items: string[], count: number): string[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(1, Math.min(pool.length, count)));
}
