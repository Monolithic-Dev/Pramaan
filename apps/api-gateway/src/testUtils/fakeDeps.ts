import type { AuthVerifier, DecodedAuth } from "../lib/authVerifier.js";
import type {
  AncestryStep,
  AvailableData,
  BigQueryAgentClient,
  InvestmentSummary,
  RegionInfo,
} from "../lib/bigquery.js";
import type { AgentTurnResponse, GeminiAgentClient } from "../lib/geminiAgent.js";
import type { IdentityToolkit } from "../lib/identityToolkit.js";
import type { MediaStore } from "../lib/mediaStore.js";
import type { OfficerAccount, OfficerAdmin } from "../lib/officerAdmin.js";
import type { Narrator } from "../lib/narrator.js";
import type { Translator } from "../lib/translator.js";
import type { Publisher } from "../lib/pubsub.js";
import { createInMemoryStore } from "../store/inMemoryStore.js";
import type { Deps } from "../deps.js";

export interface FakeDeps extends Omit<Deps, "store"> {
  store: ReturnType<typeof createInMemoryStore>;
  publishedMessages: unknown[];
  /** Maps a fake token string to the decoded identity it should resolve to. */
  tokens: Map<string, DecodedAuth>;
  /** Maps a fake sessionInfo/OTP pair to the phone number and verified UID. */
  otpSessions: Map<string, { phone: string; code: string; uid: string }>;
  /** Test-configurable BigQuery data, keyed by regionId (and regionId+category). */
  ancestryByRegion: Map<string, AncestryStep[]>;
  investmentByRegionCategory: Map<string, InvestmentSummary[]>;
  availableDataByRegion: Map<string, AvailableData>;
  /** Queue consumed front-to-back by geminiAgent.generateTurn(). */
  nextAgentResponses: AgentTurnResponse[];
  /** Regions served by listRegions() (pickers, filters, names). */
  regions: RegionInfo[];
  officerAccounts: OfficerAccount[];
  storedMedia: { kind: string; contentType: string; bytes: number }[];
}

export function createFakeDeps(): FakeDeps {
  const publishedMessages: unknown[] = [];
  const tokens = new Map<string, DecodedAuth>();
  const otpSessions = new Map<string, { phone: string; code: string; uid: string }>();
  const ancestryByRegion = new Map<string, AncestryStep[]>();
  const investmentByRegionCategory = new Map<string, InvestmentSummary[]>();
  const availableDataByRegion = new Map<string, AvailableData>();
  const nextAgentResponses: AgentTurnResponse[] = [];
  const regions: RegionInfo[] = [];
  const officerAccounts: OfficerAccount[] = [];
  const officerAdmin: OfficerAdmin = {
    async list() {
      return officerAccounts;
    },
    async create({ email, role, regionId, countryCode }) {
      if (officerAccounts.some((a) => a.email === email)) throw new Error("email already exists");
      const account: OfficerAccount = {
        uid: `uid_${officerAccounts.length + 1}`, email, role, region_id: regionId, country_code: countryCode,
        disabled: false, created_at: "2026-01-01T00:00:00Z", last_sign_in: null,
      };
      officerAccounts.push(account);
      return account;
    },
    async setDisabled(uid, disabled) {
      const account = officerAccounts.find((a) => a.uid === uid);
      if (account) account.disabled = disabled;
      return account ?? null;
    },
  };
  const storedMedia: { kind: string; contentType: string; bytes: number }[] = [];
  const mediaStore: MediaStore = {
    maxBytes: { photo: 8 * 1024 * 1024, audio: 10 * 1024 * 1024 },
    owns: (url) => url.startsWith("gs://test-bucket/"),
    async put(kind, contentType, data) {
      storedMedia.push({ kind, contentType, bytes: data.length });
      return `gs://test-bucket/${kind}s/${storedMedia.length}`;
    },
    async get(url) {
      return url.startsWith("gs://test-bucket/") ? { data: Buffer.from("fake-image"), contentType: "image/jpeg" } : null;
    },
  };
  const translator: Translator = {
    async translate(text, lang) {
      return `[${lang}] ${text}`;
    },
  };

  const narrator: Narrator = {
    async narrate(_facts, language) {
      return `Briefing in ${language}.`;
    },
  };

  const authVerifier: AuthVerifier = {
    async verifyIdToken(token) {
      const decoded = tokens.get(token);
      if (!decoded) throw new Error("invalid token");
      return decoded;
    },
  };

  const publisher: Publisher = {
    async publishRawSubmission(payload) {
      publishedMessages.push(payload);
    },
  };

  const identityToolkit: IdentityToolkit = {
    async sendVerificationCode(phone) {
      const sessionInfo = `session_${otpSessions.size}`;
      otpSessions.set(sessionInfo, { phone, code: "111111", uid: `uid_${phone}` });
      return { sessionInfo };
    },
    async verifyPhoneNumber(sessionInfo, code) {
      const session = otpSessions.get(sessionInfo);
      if (!session || session.code !== code) throw new Error("invalid otp");
      return { idToken: `token_${session.uid}`, localId: session.uid, phoneNumber: session.phone };
    },
  };

  const bigqueryAgent: BigQueryAgentClient = {
    async getAncestryChain(regionId) {
      return ancestryByRegion.get(regionId) ?? [{ regionId, level: "ward" }];
    },
    async listRegions(filter = {}) {
      return regions.filter(
        (r) =>
          (!filter.level || r.level === filter.level) &&
          (!filter.parentId || r.parentRegionId === filter.parentId) &&
          (!filter.countryCode || r.countryCode === filter.countryCode),
      );
    },
    async getInvestmentRecords(regionId, category) {
      return investmentByRegionCategory.get(`${regionId}|${category}`) ?? [];
    },
    async getAvailableData(regionId) {
      return availableDataByRegion.get(regionId) ?? { infraIndexTypes: [], investmentFiscalYears: [] };
    },
  };

  const geminiAgent: GeminiAgentClient = {
    async generateTurn() {
      if (nextAgentResponses.length === 0) {
        throw new Error("createFakeDeps: no queued agent response — configure nextAgentResponses");
      }
      return nextAgentResponses.shift()!;
    },
  };

  return {
    store: createInMemoryStore(),
    publisher,
    identityToolkit,
    authVerifier,
    bigqueryAgent,
    geminiAgent,
    mediaStore,
    translator,
    narrator,
    storedMedia,
    publishedMessages,
    tokens,
    otpSessions,
    ancestryByRegion,
    investmentByRegionCategory,
    availableDataByRegion,
    nextAgentResponses,
    regions,
    officerAccounts,
    officerAdmin,
  };
}
