import { describe, it, expect } from "vitest";
import {
  buildAnalysisPrompt,
  extractSections,
  parseAnalysisResponse,
  DIMENSION_KEYS,
  HOOK_TYPES,
  type AnalysisInput,
  type ParsedAnalysis,
} from "@/lib/prompts/analysis";

// ---------------------------------------------------------------------------
// Sample LLM response for testing the parser
// ---------------------------------------------------------------------------

const SAMPLE_LLM_RESPONSE = `## 게시물 정보
(생략)

## Hook 분석
이 게시물은 "솔직히 말하면"이라는 오프닝으로 시작하여 독자의 호기심을 자극합니다. 일반적으로 금기시되는 주제를 꺼내겠다는 암시가 스크롤을 멈추게 합니다. 대화체의 자연스러운 톤이 친구의 이야기를 듣는 듯한 친밀감을 형성합니다.

## Hook 유형
curiosity

## 감정 분석
공감과 안도감이 핵심 감정입니다. 많은 사람이 느끼지만 말하지 않는 감정을 대신 표현해줌으로써 강한 정서적 연결을 만듭니다. "나만 그런 게 아니었구나"라는 안도감이 좋아요를 누르는 주된 동기가 됩니다.

## 구조 분석
짧은 문장들의 연속으로 구성되어 모바일에서의 가독성이 뛰어납니다. 각 문장이 하나의 완결된 생각을 담고 있어 스캔하기 쉽습니다. 전체 길이도 Threads의 최적 길이인 100-200자 범위에 맞춰져 있습니다.

## CTA 분석
명시적 CTA는 없지만, 게시물 자체가 암묵적으로 "당신도 이렇게 느끼나요?"라는 질문을 던집니다. 이런 암시적 CTA가 오히려 댓글을 유도하는 강력한 장치로 작동합니다.

## 대화 유발 분석
개인적 경험을 공유하는 포맷이 독자들의 자기 개방을 유도합니다. "맞아, 나도!"라는 반응이 자연스럽게 댓글로 이어지는 구조입니다. 논쟁적이지 않으면서도 다양한 관점의 경험 공유가 가능한 주제 선정이 핵심입니다.

## 공유 유발 분석
"이건 내 이야기다"라는 자기 투영이 공유의 주된 동기입니다. 리포스트를 통해 자신의 정체성이나 가치관을 표현할 수 있는 콘텐츠입니다. 부정적이거나 논란이 되지 않아 공유의 심리적 장벽이 낮습니다.

## 메타데이터
- 미디어 연관성: 해당 없음
- 길이 분석: 150자 내외의 짧은 길이가 Threads 피드에서 잘린 부분 없이 전문이 노출되는 장점이 있습니다.
- 기타: 평일 저녁 시간대 게시로 직장인 대상 콘텐츠에 최적화된 타이밍입니다.`;

// ---------------------------------------------------------------------------
// buildAnalysisPrompt
// ---------------------------------------------------------------------------

describe("buildAnalysisPrompt", () => {
  const baseInput: AnalysisInput = {
    textContent: "솔직히 말하면 나도 처음엔 겁났다",
    mediaType: "text",
    likeCount: 5200,
    repostCount: 320,
    replyCount: 180,
    outlierScore: 7.3,
    username: "testuser",
  };

  it("includes all required sections", () => {
    const prompt = buildAnalysisPrompt(baseInput);

    expect(prompt).toContain("@testuser");
    expect(prompt).toContain("솔직히 말하면");
    expect(prompt).toContain("7.3x");
    expect(prompt).toContain("## Hook 분석");
    expect(prompt).toContain("## Hook 유형");
    expect(prompt).toContain("## 감정 분석");
    expect(prompt).toContain("## 구조 분석");
    expect(prompt).toContain("## CTA 분석");
    expect(prompt).toContain("## 대화 유발 분석");
    expect(prompt).toContain("## 공유 유발 분석");
    expect(prompt).toContain("## 메타데이터");
  });

  it("includes engagement metrics", () => {
    const prompt = buildAnalysisPrompt(baseInput);

    expect(prompt).toContain("5,200");
    expect(prompt).toContain("320");
    expect(prompt).toContain("180");
    expect(prompt).toContain("5,700");
  });

  it("handles null text content", () => {
    const prompt = buildAnalysisPrompt({ ...baseInput, textContent: null });
    expect(prompt).toContain("(텍스트 없음, 미디어만 포함)");
  });

  it("handles null outlier score", () => {
    const prompt = buildAnalysisPrompt({ ...baseInput, outlierScore: null });
    expect(prompt).toContain("측정 불가");
  });

  it("includes media type", () => {
    const prompt = buildAnalysisPrompt({ ...baseInput, mediaType: "carousel" });
    expect(prompt).toContain("carousel");
  });
});

// ---------------------------------------------------------------------------
// extractSections
// ---------------------------------------------------------------------------

describe("extractSections", () => {
  it("extracts all sections from well-formatted LLM output", () => {
    const sections = extractSections(SAMPLE_LLM_RESPONSE);

    expect(sections["Hook 분석"]).toBeTruthy();
    expect(sections["Hook 유형"]).toBeTruthy();
    expect(sections["감정 분석"]).toBeTruthy();
    expect(sections["구조 분석"]).toBeTruthy();
    expect(sections["CTA 분석"]).toBeTruthy();
    expect(sections["대화 유발 분석"]).toBeTruthy();
    expect(sections["공유 유발 분석"]).toBeTruthy();
    expect(sections["메타데이터"]).toBeTruthy();
  });

  it("handles empty text", () => {
    const sections = extractSections("");
    expect(Object.keys(sections)).toHaveLength(0);
  });

  it("handles text without ## headers", () => {
    const sections = extractSections("Just some text without headers");
    expect(Object.keys(sections)).toHaveLength(0);
  });

  it("handles partial output (mid-stream)", () => {
    const partial = `## Hook 분석
이 게시물은 강한 오프닝으로 시작합니다. 호기심을 자극하는 표현이 핵심입니다.

## 감정 분석`;

    const sections = extractSections(partial);
    expect(sections["Hook 분석"]).toBeTruthy();
    // 감정 분석 has no content after the header
    expect(sections["감정 분석"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseAnalysisResponse
// ---------------------------------------------------------------------------

describe("parseAnalysisResponse", () => {
  it("parses a complete LLM response into structured fields", () => {
    const result = parseAnalysisResponse(SAMPLE_LLM_RESPONSE);

    // All 6 dimensions should be present
    for (const key of DIMENSION_KEYS) {
      expect(result[key]).toBeTruthy();
      expect(result[key].length).toBeGreaterThan(10);
    }
  });

  it("extracts hook type correctly", () => {
    const result = parseAnalysisResponse(SAMPLE_LLM_RESPONSE);
    expect(result.hookType).toBe("curiosity");
  });

  it("extracts metadata fields", () => {
    const result = parseAnalysisResponse(SAMPLE_LLM_RESPONSE);

    // "해당 없음" should be normalized to null
    expect(result.metadata.mediaRelevance).toBeNull();
    expect(result.metadata.lengthAnalysis).toBeTruthy();
    expect(result.metadata.timingNote).toBeTruthy();
  });

  it("handles all valid hook types", () => {
    for (const hookType of HOOK_TYPES) {
      const text = `## Hook 분석
Some analysis here.

## Hook 유형
${hookType}

## 감정 분석
Emotion analysis.

## 구조 분석
Structure analysis.

## CTA 분석
CTA analysis.

## 대화 유발 분석
Conversation analysis.

## 공유 유발 분석
Sharing analysis.

## 메타데이터
- 미디어 연관성: 해당 없음
- 길이 분석: short
- 기타: none`;

      const result = parseAnalysisResponse(text);
      expect(result.hookType).toBe(hookType);
    }
  });

  it("returns null hookType for unrecognized values", () => {
    const text = `## Hook 유형
unknown_type`;

    const result = parseAnalysisResponse(text);
    expect(result.hookType).toBeNull();
  });

  it("handles missing sections gracefully", () => {
    const result = parseAnalysisResponse("## Hook 분석\nSome analysis.");

    expect(result.hook).toBe("Some analysis.");
    expect(result.emotion).toBe("");
    expect(result.structure).toBe("");
    expect(result.cta).toBe("");
    expect(result.conversation).toBe("");
    expect(result.sharing).toBe("");
  });

  it("handles empty string", () => {
    const result = parseAnalysisResponse("");

    expect(result.hook).toBe("");
    expect(result.hookType).toBeNull();
    expect(result.metadata.mediaRelevance).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("prompt edge cases", () => {
  it("handles zero engagement metrics", () => {
    const prompt = buildAnalysisPrompt({
      textContent: "Test",
      mediaType: "text",
      likeCount: 0,
      repostCount: 0,
      replyCount: 0,
      outlierScore: 0,
      username: "user",
    });

    expect(prompt).toContain("0.0x");
    expect(prompt).toContain("총 인게이지먼트: 0");
  });

  it("handles very large numbers", () => {
    const prompt = buildAnalysisPrompt({
      textContent: "Viral post",
      mediaType: "video",
      likeCount: 1_500_000,
      repostCount: 200_000,
      replyCount: 50_000,
      outlierScore: 42.5,
      username: "viral_user",
    });

    expect(prompt).toContain("1,500,000");
    expect(prompt).toContain("42.5x");
  });

  it("sanitizes special characters in text content", () => {
    const prompt = buildAnalysisPrompt({
      textContent: "Hello ## with markdown\n## and headers",
      mediaType: "text",
      likeCount: 100,
      repostCount: 10,
      replyCount: 5,
      outlierScore: 3.0,
      username: "user",
    });

    // Text should be included as-is (LLM handles the context)
    expect(prompt).toContain("Hello ## with markdown");
  });
});
