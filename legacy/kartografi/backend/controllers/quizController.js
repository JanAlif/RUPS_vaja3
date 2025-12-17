import crypto from "node:crypto";

const REST_COUNTRIES_BASE = "https://restcountries.com/v3.1";
const SUPPORTED_TYPES = new Set(["country", "main_city", "language", "flag"]);
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cachedCountries = null;
let cachedAt = 0;

const baseFetch = globalThis.fetch;

if (typeof baseFetch !== "function") {
  throw new Error("Global fetch API is unavailable. Please run the server on Node.js 18 or newer.");
}

async function fetchJson(url) {
  const response = await baseFetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed (${response.status}): ${text || response.statusText}`);
  }
  return response.json();
}

async function getCountries() {
  const now = Date.now();
  if (!cachedCountries || now - cachedAt > CACHE_TTL_MS) {
    const fields = "name,capital,languages,flags,cca3";
    const url = `${REST_COUNTRIES_BASE}/all?fields=${fields}`;
    cachedCountries = await fetchJson(url);
    cachedAt = now;
  }
  return cachedCountries;
}

function createQuestionKey(type, meta) {
  const encoded = Buffer.from(JSON.stringify(meta)).toString("base64url");
  return `${type}|${encoded}`;
}

function decodeQuestionKey(raw) {
  if (typeof raw !== "string" || !raw.includes("|")) {
    throw new Error("Malformed question key");
  }
  const [type, payload] = raw.split("|");
  if (!SUPPORTED_TYPES.has(type)) {
    throw new Error(`Unsupported question type "${type}"`);
  }
  try {
    const meta = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return { type, meta };
  } catch {
    throw new Error("Invalid question metadata");
  }
}

function normalize(value) {
  return value
    .toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function pickRandom(list) {
  return list[Math.floor(crypto.randomInt(0, list.length))];
}

async function buildCountryQuestion() {
  const countries = await getCountries();
  const languageMap = new Map();

  for (const country of countries) {
    const languages = country.languages || {};
    for (const [code, languageName] of Object.entries(languages)) {
      if (!languageMap.has(code)) {
        languageMap.set(code, {
          code,
          name: languageName,
          countries: new Set(),
        });
      }
      languageMap.get(code).countries.add(country.name?.common);
    }
  }

  const eligible = Array.from(languageMap.values()).filter((entry) => entry.countries.size);
  if (!eligible.length) {
    throw new Error("No languages available to generate a question");
  }

  const choice = pickRandom(eligible);
  const prompt =
    choice.countries.size > 1
      ? `Name a country where ${choice.name} is an official language.`
      : `Which country has ${choice.name} as an official language?`;

  return {
    type: "country",
    prompt,
    questionKey: createQuestionKey("country", {
      languageCode: choice.code,
      languageName: choice.name,
    }),
    data: {
      language: choice.name,
      possibleAnswers: choice.countries.size,
    },
  };
}

async function buildMainCityQuestion() {
  const countries = (await getCountries()).filter(
    (country) => Array.isArray(country.capital) && country.capital.length && country.cca3
  );
  if (!countries.length) {
    throw new Error("No countries with capitals available");
  }
  const choice = pickRandom(countries);

  return {
    type: "main_city",
    prompt: `What is the capital city of ${choice.name?.common}?`,
    questionKey: createQuestionKey("main_city", { cca3: choice.cca3 }),
    data: {
      country: choice.name?.common,
    },
  };
}

async function buildLanguageQuestion() {
  const countries = (await getCountries()).filter(
    (country) => country.languages && Object.keys(country.languages).length && country.cca3
  );
  if (!countries.length) {
    throw new Error("No countries with language data available");
  }
  const choice = pickRandom(countries);

  return {
    type: "language",
    prompt: `Name an official language of ${choice.name?.common}.`,
    questionKey: createQuestionKey("language", { cca3: choice.cca3 }),
    data: {
      country: choice.name?.common,
      languageCount: Object.keys(choice.languages).length,
    },
  };
}

async function buildFlagQuestion() {
  const countries = (await getCountries()).filter(
    (country) => country.flags?.png && country.cca3
  );
  if (!countries.length) {
    throw new Error("No countries with flag data available");
  }
  const choice = pickRandom(countries);

  return {
    type: "flag",
    prompt: "Which country does this flag belong to?",
    questionKey: createQuestionKey("flag", { cca3: choice.cca3 }),
    data: {
      flagUrl: choice.flags.png,
      flagAlt: choice.flags.alt || `Flag of ${choice.name?.common}`,
    },
  };
}

async function generateQuestion(type) {
  switch (type) {
    case "country":
      return buildCountryQuestion();
    case "main_city":
      return buildMainCityQuestion();
    case "language":
      return buildLanguageQuestion();
    case "flag":
      return buildFlagQuestion();
    default:
      throw new Error(`Unsupported question type "${type}"`);
  }
}

async function evaluateCountry(meta, answer) {
  const { languageCode, languageName } = meta || {};
  if (!languageCode) {
    throw new Error("Invalid country question metadata");
  }

  const url = `${REST_COUNTRIES_BASE}/lang/${encodeURIComponent(languageCode)}`;
  const data = await fetchJson(url);

  const answerNorm = normalize(answer);
  const matched = [];

  for (const country of data) {
    const names = [
      country.name?.common,
      country.name?.official,
      ...(country.altSpellings || []),
    ].filter(Boolean);
    if (names.some((name) => normalize(name) === answerNorm)) {
      matched.push(country.name?.common || country.name?.official);
    }
  }

  if (matched.length) {
    return {
      type: "country",
      correct: true,
      info: {
        language: languageName,
        matched: matched[0],
      },
    };
  }

  return {
    type: "country",
    correct: false,
    info: {
      language: languageName,
      acceptableAnswers: data.slice(0, 5).map((country) => country.name?.common).filter(Boolean),
    },
  };
}

async function evaluateMainCity(meta, answer) {
  const { cca3 } = meta || {};
  if (!cca3) {
    throw new Error("Invalid main_city question metadata");
  }
  const url = `${REST_COUNTRIES_BASE}/alpha/${encodeURIComponent(cca3)}?fields=name,capital`;
  const data = await fetchJson(url);
  const country = Array.isArray(data) ? data[0] : data;

  const capitals = (country?.capital || []).filter(Boolean);
  const answerNorm = normalize(answer);
  const match = capitals.find((capital) => normalize(capital) === answerNorm);

  return {
    type: "main_city",
    correct: Boolean(match),
    info: {
      country: country?.name?.common,
      capitals,
    },
  };
}

async function evaluateLanguage(meta, answer) {
  const { cca3 } = meta || {};
  if (!cca3) {
    throw new Error("Invalid language question metadata");
  }
  const url = `${REST_COUNTRIES_BASE}/alpha/${encodeURIComponent(cca3)}?fields=name,languages`;
  const data = await fetchJson(url);
  const country = Array.isArray(data) ? data[0] : data;

  const languages = country?.languages || {};
  const answerNorm = normalize(answer);
  const match = Object.entries(languages).find(
    ([code, name]) => normalize(code) === answerNorm || normalize(name) === answerNorm
  );

  return {
    type: "language",
    correct: Boolean(match),
    info: {
      country: country?.name?.common,
      languages: Object.values(languages),
    },
  };
}

async function evaluateFlag(meta, answer) {
  const { cca3 } = meta || {};
  if (!cca3) {
    throw new Error("Invalid flag question metadata");
  }
  const url = `${REST_COUNTRIES_BASE}/alpha/${encodeURIComponent(cca3)}?fields=name,altSpellings`;
  const data = await fetchJson(url);
  const country = Array.isArray(data) ? data[0] : data;

  const candidates = [
    country?.name?.common,
    country?.name?.official,
    ...(country?.altSpellings || []),
  ].filter(Boolean);
  const answerNorm = normalize(answer);
  const match = candidates.find((value) => normalize(value) === answerNorm);

  return {
    type: "flag",
    correct: Boolean(match),
    info: {
      country: country?.name?.common,
    },
  };
}

async function evaluateAnswer(questionKey, answer) {
  const { type, meta } = decodeQuestionKey(questionKey);
  switch (type) {
    case "country":
      return evaluateCountry(meta, answer);
    case "main_city":
      return evaluateMainCity(meta, answer);
    case "language":
      return evaluateLanguage(meta, answer);
    case "flag":
      return evaluateFlag(meta, answer);
    default:
      throw new Error(`Unsupported question type "${type}"`);
  }
}

/**
 * POST handler for quiz flow.
 * Body shape:
 *   { question: "language" | questionKey, anwser?: string }
 * - When anwser/answer is missing or empty, a fresh question payload is returned.
 * - When anwser is provided, the question field must contain the questionKey to validate the answer.
 */
export async function handleQuiz(req, res) {
  try {
    const raw = req.body || {};
    const rawQuestion = raw.question;
    const rawAnswer = raw.anwser ?? raw.answer ?? "";
    if (typeof rawQuestion !== "string" || !rawQuestion.trim()) {
      return res.status(400).json({ error: "Missing question parameter" });
    }

    const question = rawQuestion.trim();
    const answer = typeof rawAnswer === "string" ? rawAnswer.trim() : "";
    const hasAnswer = Boolean(answer);

    if (!hasAnswer) {
      if (!SUPPORTED_TYPES.has(question)) {
        return res.status(400).json({ error: `Unsupported question type "${question}"` });
      }
      const payload = await generateQuestion(question);
      return res.json({ mode: "question", ...payload });
    }

    const result = await evaluateAnswer(question, answer);
    return res.json({ mode: "answer", ...result });
  } catch (error) {
    console.error("[quiz] error", error);
    return res.status(500).json({ error: "Failed to process quiz request" });
  }
}
