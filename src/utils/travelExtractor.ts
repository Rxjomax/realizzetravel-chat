// Automatic AI / heuristic parameter extractor for travel conversations
export interface ExtractedTravelParams {
  destination?: string;
  travelDate?: string;
  passengerCount?: number;
  budget?: string;
  confidence: number;
}

const KNOWN_DESTINATIONS = [
  'Porto Seguro, BA',
  'Gramado & Canela, RS',
  'Recife, PE',
  'Orlando, EUA',
  'Cruzeiro Costa / MSC',
  'Fernando de Noronha, PE',
  'Maceió, AL',
  'Salvador e Litoral Norte, BA',
  'Maragogi, AL',
  'Natal e Pipa, RN',
  'Fortaleza e Jericoacoara, CE',
  'Cancún, México',
  'Paris, França',
  'Lisboa, Portugal',
  'Santiago e Valle Nevado, Chile',
  'Bariloche, Argentina',
  'Beto Carrero World, SC',
  'Foz do Iguaçu, PR',
  'Rio de Janeiro, RJ',
  'Florianópolis, SC',
];

export function extractTravelParameters(text: string): ExtractedTravelParams {
  if (!text) return { confidence: 0 };
  const lower = text.toLowerCase();

  let destination: string | undefined;
  let travelDate: string | undefined;
  let passengerCount: number | undefined;
  let budget: string | undefined;
  let score = 0;

  // 1. Destination Detection
  if (lower.includes('porto seguro')) {
    destination = 'Porto Seguro, BA';
    score++;
  } else if (lower.includes('gramado') || lower.includes('canela')) {
    destination = 'Gramado & Canela, RS';
    score++;
  } else if (lower.includes('recife') || lower.includes('porto de galinhas')) {
    destination = 'Recife, PE';
    score++;
  } else if (lower.includes('orlando') || lower.includes('disney') || lower.includes('universal')) {
    destination = 'Orlando, EUA';
    score++;
  } else if (lower.includes('cruzeiro') || lower.includes('costa') || lower.includes('msc')) {
    destination = 'Cruzeiro Costa / MSC';
    score++;
  } else if (lower.includes('noronha')) {
    destination = 'Fernando de Noronha, PE';
    score++;
  } else if (lower.includes('maceio') || lower.includes('maceió') || lower.includes('maragogi')) {
    destination = 'Maceió & Maragogi, AL';
    score++;
  } else if (lower.includes('salvador') || lower.includes('praia do forte') || lower.includes('morro de são paulo')) {
    destination = 'Salvador e Litoral Norte, BA';
    score++;
  } else if (lower.includes('cancun') || lower.includes('cancún')) {
    destination = 'Cancún, México';
    score++;
  } else if (lower.includes('natal') || lower.includes('pipa')) {
    destination = 'Natal e Pipa, RN';
    score++;
  } else if (lower.includes('fortaleza') || lower.includes('jericoacoara') || lower.includes('jeri')) {
    destination = 'Fortaleza e Jericoacoara, CE';
    score++;
  } else if (lower.includes('paris') || lower.includes('frança')) {
    destination = 'Paris, França';
    score++;
  } else if (lower.includes('lisboa') || lower.includes('portugal')) {
    destination = 'Portugal & Espanha';
    score++;
  } else if (lower.includes('bariloche')) {
    destination = 'Bariloche, Argentina';
    score++;
  } else if (lower.includes('beto carrero')) {
    destination = 'Beto Carrero World, SC';
    score++;
  } else if (lower.includes('foz do iguaçu') || lower.includes('foz do iguacu')) {
    destination = 'Foz do Iguaçu, PR';
    score++;
  }

  // 2. Date / Period Detection
  if (lower.includes('réveillon') || lower.includes('reveillon') || lower.includes('ano novo')) {
    travelDate = '2026-12-28 (Réveillon)';
    score++;
  } else if (lower.includes('carnaval')) {
    travelDate = '2027-02-12 (Carnaval)';
    score++;
  } else if (lower.includes('novembro')) {
    travelDate = '2026-11-15';
    score++;
  } else if (lower.includes('outubro')) {
    travelDate = '2026-10-08';
    score++;
  } else if (lower.includes('dezembro')) {
    travelDate = '2026-12-10';
    score++;
  } else if (lower.includes('janeiro')) {
    travelDate = '2027-01-10';
    score++;
  } else if (lower.includes('setembro')) {
    travelDate = '2026-09-20';
    score++;
  } else if (lower.includes('férias de julho') || lower.includes('julho')) {
    travelDate = '2027-07-10';
    score++;
  } else {
    // Check regex for dates like dd/mm or dd/mm/yyyy
    const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const month = dateMatch[2].padStart(2, '0');
      const year = dateMatch[3] ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : '2026';
      travelDate = `${year}-${month}-${day}`;
      score++;
    }
  }

  // 3. Passenger Count
  if (lower.includes('casal e 1 filho') || lower.includes('casal e uma criança') || lower.includes('3 pessoas') || lower.includes('3 passageiros')) {
    passengerCount = 3;
    score++;
  } else if (lower.includes('casal e 2 filhos') || lower.includes('4 pessoas') || lower.includes('4 passageiros') || lower.includes('família de 4')) {
    passengerCount = 4;
    score++;
  } else if (lower.includes('casal') || lower.includes('2 pessoas') || lower.includes('2 adultos') || lower.includes('eu e meu marido') || lower.includes('eu e minha esposa')) {
    passengerCount = 2;
    score++;
  } else if (lower.includes('sozinho') || lower.includes('1 pessoa') || lower.includes('1 passageiro') || lower.includes('1 adulto')) {
    passengerCount = 1;
    score++;
  } else {
    const paxMatch = text.match(/(\d+)\s*(?:pessoas|passageiros|adultos)/i);
    if (paxMatch) {
      passengerCount = parseInt(paxMatch[1], 10);
      score++;
    }
  }

  // 4. Budget Detection
  const budgetMatch = text.match(/(?:r\$\s*|orçamento\s*(?:de\s*)?|teto\s*(?:de\s*)?|até\s*)(\d{1,3}(?:\.\d{3})*|\d+)(?:[,.](\d{2}))?\s*(?:mil|reais)?/i);
  if (budgetMatch) {
    let rawVal = budgetMatch[1];
    if (lower.includes('mil') && !rawVal.includes('.')) {
      budget = `R$ ${rawVal}.000`;
    } else {
      budget = `R$ ${rawVal}`;
    }
    score++;
  } else if (lower.includes('econômico') || lower.includes('promocional')) {
    budget = 'Até R$ 3.500';
    score++;
  }

  return {
    destination,
    travelDate,
    passengerCount,
    budget,
    confidence: score,
  };
}

export function hasExtractedAnyInfo(params: ExtractedTravelParams): boolean {
  return Boolean(params.destination || params.travelDate || params.passengerCount || params.budget);
}

export function parseBudgetValue(budgetStr?: string | null): number {
  if (!budgetStr) return 0;
  const lower = budgetStr.toLowerCase().trim();
  const digits = lower.replace(/[^\d.,]/g, '');
  if (!digits) return 0;

  let cleanNum = digits;
  if (cleanNum.includes('.') && cleanNum.includes(',')) {
    cleanNum = cleanNum.replace(/\./g, '').replace(',', '.');
  } else if (cleanNum.includes(',') && !cleanNum.includes('.')) {
    cleanNum = cleanNum.replace(',', '.');
  } else if (cleanNum.includes('.') && cleanNum.split('.')[1]?.length === 3) {
    cleanNum = cleanNum.replace(/\./g, '');
  }

  let parsed = parseFloat(cleanNum);
  if (isNaN(parsed)) return 0;
  if (lower.includes('mil') && parsed < 1000) {
    parsed *= 1000;
  }
  return parsed;
}
