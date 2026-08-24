import Link from "next/link";
import { ConceptCandidateButton } from "@/components/concept-candidate-button";
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
    start: index,
    text: segment,
    pieces: positioned
      .filter((item) => item.start < index + segment.length && item.end > index)
      .map((item) => ({
        text: text.slice(Math.max(item.start, index), Math.min(item.end, index + segment.length)),
        concept: item.concept,
        candidate: item.candidate,
      })),
  }));
}

function piece(sessionId: string, segment: AnnotatedSegment, key: string, candidateAction?: (term: string) => void | Promise<void>) {
  if (segment.concept) return <Link key={key} href={`/study/${sessionId}/concepts/${segment.concept.slug}`} className={`concept-link concept-${segment.concept.tone}`} title={`Otwórz pojęcie: ${segment.concept.name}`}>{segment.text}</Link>;
  if (segment.candidate && candidateAction) return <ConceptCandidateButton key={key} term={segment.candidate.term} action={candidateAction}>{segment.text}</ConceptCandidateButton>;
  return <span key={key}>{segment.text}</span>;
}

export function ConceptText({ sessionId, explanationSource, segments, candidateAction }: {
  sessionId: string;
  explanationSource?: ExplanationSource;
  segments: AnnotatedSegment[];
  candidateAction?: (term: string) => void | Promise<void>;
}) {
  const groups = sentenceGroups(segments);
  return <span className="message-text">{groups.map((group) => {
    const content = group.pieces.map((segment, pieceIndex) => piece(sessionId, segment, `${group.start}-${pieceIndex}`, candidateAction));
    return explanationSource
      ? <SentenceExplanation key={group.start} sentence={group.text} source={explanationSource}>{content}</SentenceExplanation>
      : <span key={group.start}>{content}</span>;
  })}</span>;
}
