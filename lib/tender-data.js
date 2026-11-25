import connectDB from "./db.js";
import Tender from "../models/Tender.js";
import { getAllTenders, getTenderById } from "../data/tenders.js";
import { normalizeGemDocumentUrl } from "./gem-ingestion.js";

export { normalizeGemDocumentUrl };

export function encodeGemInternalId(officialTenderId) {
  if (typeof officialTenderId !== "string" || !officialTenderId.trim()) return null;
  return `gem-${Buffer.from(officialTenderId, "utf8").toString("base64url")}`;
}

export function decodeGemInternalId(internalId) {
  if (typeof internalId !== "string" || !internalId.startsWith("gem-")) return null;
  const encoded = internalId.slice(4);
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;

  try {
    const officialTenderId = Buffer.from(encoded, "base64url").toString("utf8");
    if (
      !officialTenderId ||
      Buffer.from(officialTenderId, "utf8").toString("base64url") !== encoded
    ) {
      return null;
    }
    return officialTenderId;
  } catch {
    return null;
  }
}


export function mapGemTender(record) {
  if (!record) return null;
  function formatDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const submissionDeadline = formatDate(record.submissionDeadline);
  const publishedAt = formatDate(record.publishedAt);

  return {
    id: encodeGemInternalId(record.officialTenderId),
    source: "GEM",
    recordType: "real",
    officialTenderId: record.officialTenderId,
    externalId: record.externalId || null,
    title: record.title,
    bidType: record.bidType || null,
    quantity: record.quantity ?? null,
    ministryOrState: record.ministryOrState || null,
    department: record.department || null,
    publishedAt,
    submissionDeadline,
    isHighValue: record.isHighValue ?? null,
    isGlobalTender: record.isGlobalTender ?? null,
    isLimitedTender: record.isLimitedTender ?? null,
    currency: record.currency || null,
    documentUrl: normalizeGemDocumentUrl(record.documentUrl),
    portalUrl: record.portalUrl || null,
    daysToClose: null,
    sourceFetchedAt: formatDate(record.sourceFetchedAt),
    lastFetchedAt: formatDate(record.lastFetchedAt),
    category: null,
    location: null,
    estimatedValue: null,
    description: record.title,
    eligibilityRequirements: [],
    relevanceKeywords: [],
  };
}

export async function getCatalogueTenders() {
  try {
    await connectDB();
    const records = await Tender.find({ source: "GEM" })
      .sort({ submissionDeadline: 1, lastFetchedAt: -1 })
      .lean();
    return [...getAllTenders(), ...records.map(mapGemTender).filter(Boolean)];
  } catch {
    return getAllTenders();
  }
}

export async function getCatalogueTenderById(id, dependencies = {}) {
  if (typeof id !== "string" || !id) return undefined;
  const staticTender = getTenderById(id);
  if (staticTender) return staticTender;
  const officialTenderId = decodeGemInternalId(id);
  if (!officialTenderId) return undefined;

  try {
    const connect = dependencies.connectDB || connectDB;
    const TenderModel = dependencies.TenderModel || Tender;
    await connect();
    const record = await TenderModel.findOne({
      source: "GEM",
      officialTenderId,
    }).lean();
    return mapGemTender(record);
  } catch {
    return undefined;
  }
}
