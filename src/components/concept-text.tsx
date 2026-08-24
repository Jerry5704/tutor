import Link from "next/link";
import { SentenceExplanation, type ExplanationSource } from "@/components/sentence-explanation";
import type { AnnotatedSegment } from "@/server/services/concept-annotation";

type PositionedSegment = AnnotatedSegment & { start: number; end: number };

function sentenceGroups(segments: AnnotatedSegment[]) {
  const text = segments.map((segment) => segment.text).join("");
  let offset = 0;
  const positioned: PositionedSegment[] = segments.map((segment) => {
    const item = { ...segment, start: offset, end: offset + segment.text.length };
    offset = item.end;
    return item;
  });
  const sentences = [...new Intl.Segmenter("pl", { granularity: "sentence" }).segment(text)];
  return sentences.map(({ index, segment }) => ({
    text: segment,
    pieces: positioned
      .filter((item) => item.start < index + segment.length && item.end > index)
      .map((item) => ({
        text: text.slice(Math.max(item.start, index), Math.min(item.end, index + segment.length)),
        concept: item.concept,
      })),
  }));
}

function piece(sessionId: string, segment: AnnotatedSegment, key: string) {
  return segment.concept
    ? <Link key={key} href={`/study/${sessionId}/concepts/${segment.concept.slug}`} className={`concept-link concept-${segment.concept.tone}`} title={`Otwórz pojęcie: ${segment.concept.name}`}>{segment.text}</Link>
    : <span key={key}>{segment.text}</span>;
}

export function ConceptText({ sessionId, explanationSource, segments }: {
  sessionId: string;
  explanationSource?: ExplanationSource;
  segments: AnnotatedSegment[];
}) {
  const groups = sentenceGroups(segments);
  return <span className="message-text">{groups.map((group, sentenceIndex) => {
    const content = group.pieces.map((segment, pieceIndex) => piece(sessionId, segment, `${sentenceIndex}-${pieceIndex}`));
    return explanationSource
      ? <SentenceExplanation key={sentenceIndex} sentence={group.text} source={explanationSource}>{content}</SentenceExplanation>
      : <span key={sentenceIndex}>{content}</span>;
  })}</span>;
}
