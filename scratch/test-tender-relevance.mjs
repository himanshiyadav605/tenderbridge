import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_TENDERS, getTenderById } from "../data/tenders.js";
import { DEMO_MSME_PROFILE } from "../data/msme-profile.js";
import {
  evaluateTenderMatch,
  evaluateTenderRelevance,
} from "../lib/tender-matching.js";

describe("industry-independent tender relevance", () => {
  it("matches a software company to the software development tender", () => {
    const result = evaluateTenderRelevance(getTenderById("tnd-002"), {
      industry: "Software Development",
      businessDescription:
        "We build responsive web applications and maintain public-facing software portals.",
    });

    assert.equal(result.classification, "Relevant");
    assert.ok(result.matchingTerms.length > 0);
  });

  it("matches an agricultural supplier to the agricultural equipment tender", () => {
    const result = evaluateTenderRelevance(getTenderById("tnd-006"), {
      industry: "Agricultural Equipment Supply",
      businessDescription:
        "Supply and calibration of soil testing kits, handheld analyzers, and scientific sensors.",
    });

    assert.equal(result.classification, "Relevant");
    assert.match(result.explanation, /soil|agricultural|testing|analy|equipment/i);
  });

  it("matches a construction company to the construction tender", () => {
    const result = evaluateTenderRelevance(getTenderById("tnd-007"), {
      industry: "Civil Construction",
      businessDescription:
        "Building construction and road, water supply, sanitary, and electrical maintenance.",
      completedWorks: [
        {
          workTitle: "High-altitude road and building maintenance",
          workDescription: "Civil maintenance work carried out under CPWD DSR.",
        },
      ],
    });

    assert.equal(result.classification, "Relevant");
  });

  it("supports a company from a custom industry not predefined in the application", () => {
    const customTender = {
      id: "custom-3d",
      title: "Additive Manufacturing Prototype Development",
      category: "Advanced Manufacturing",
      description: "Rapid prototyping and production using 3D printing processes.",
      relevanceKeywords: ["additive manufacturing", "3d printing", "rapid prototyping"],
    };

    const result = evaluateTenderRelevance(customTender, {
      industry: "Additive Manufacturing and 3D Printing",
      businessDescription:
        "Custom rapid prototyping and low-volume manufacturing using additive processes.",
    });

    assert.equal(result.classification, "Relevant");
    assert.ok(result.matchingTerms.length > 0);
  });

  it("does not give an unrelated company a false relevant match", () => {
    const result = evaluateTenderRelevance(getTenderById("tnd-002"), {
      industry: "Fashion Retail",
      businessDescription:
        "Retail sale of apparel, footwear, and accessories through physical stores.",
    });

    assert.equal(result.classification, "Not Relevant");
  });

  it("returns Insufficient Information when profile activity is missing", () => {
    const result = evaluateTenderRelevance(getTenderById("tnd-002"), {
      industry: "",
      businessDescription: "",
      completedWorks: [],
      ongoingWorks: [],
    });

    assert.equal(result.classification, "Insufficient Information");
  });

  it("leaves existing TND-007 eligibility results unchanged", () => {
    const tender = DEMO_TENDERS.find((item) => item.id === "tnd-007");
    const result = evaluateTenderMatch(tender, DEMO_MSME_PROFILE);

    assert.equal(result.tenderId, "tnd-007");
    assert.equal(result.overallStatus, "Needs Verification");
    assert.equal(result.criteriaResults.length, 5);
  });
});
