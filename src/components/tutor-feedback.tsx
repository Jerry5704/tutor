import { submitTutorFeedback } from "@/server/actions/tutor-feedback";

export type FeedbackTarget = "STUDY_MESSAGE" | "CONCEPT_MESSAGE" | "SIDE_CHAT_MESSAGE";
export type FeedbackRating = "HELPFUL" | "NOT_HELPFUL";

export function TutorFeedback({ targetType, targetId, currentRating }: {
  targetType: FeedbackTarget;
  targetId: string;
  currentRating?: FeedbackRating;
}) {
  return <fieldset className="tutor-feedback">
    <legend>Czy to pomogło?</legend>
    <form action={submitTutorFeedback.bind(null, targetType, targetId, "HELPFUL")}>
      <button className={currentRating === "HELPFUL" ? "selected" : ""} type="submit" aria-pressed={currentRating === "HELPFUL"} title="Pomogło">Tak</button>
    </form>
    <form action={submitTutorFeedback.bind(null, targetType, targetId, "NOT_HELPFUL")}>
      <button className={currentRating === "NOT_HELPFUL" ? "selected" : ""} type="submit" aria-pressed={currentRating === "NOT_HELPFUL"} title="Nie pomogło">Nie</button>
    </form>
  </fieldset>;
}
