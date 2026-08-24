import { db } from "@/server/db/client";
import { WikimediaVisualProvider } from "@/server/services/wikimedia-visual-provider";

const NO_VISUAL = /(?:bez|nie (?:pokazuj|dodawaj|wstawiaj))\s+(?:zdjęcia|zdjecia|obrazka|obrazu|ilustracji)/iu;
const DIFFERENT_VISUAL = /(?:inn(?:e|ą|a|y)|nie pasuje|nieadekwatn|to samo (?:zdjęcie|zdjecie|obraz))/iu;
const WANTS_VISUAL = /(?:zdjęci|zdjeci|obraz|ilustr|zobrazuj|(?:pokaż|pokaz).{0,30}(?:rysun|schemat|zdję|zdje|obraz|ilustr))/iu;

export function requestsNoVisual(text: string) {
  return NO_VISUAL.test(text);
}

export function requestsDifferentVisual(text: string) {
  return DIFFERENT_VISUAL.test(text) && WANTS_VISUAL.test(text);
}

export function requestsVisual(text: string) {
  return WANTS_VISUAL.test(text) && !requestsNoVisual(text);
}

export class VisualAidService {
  constructor(private readonly internet = new WikimediaVisualProvider()) {}

  async select(params: {
    sessionId: string;
    learningObjectiveId?: string;
    studentText: string;
    tutorText: string;
    defaultShow: boolean;
  }) {
    if (!params.learningObjectiveId) return { assetId: undefined, showVisual: false };
    if (requestsNoVisual(params.studentText) || requestsNoVisual(params.tutorText)) {
      return { assetId: undefined, showVisual: false };
    }

    const wantsDifferent = requestsDifferentVisual(params.studentText);
    const shouldShow = params.defaultShow || requestsVisual(params.studentText);
    if (!shouldShow) return { assetId: undefined, showVisual: false };

    const previous = await db.tutorMessage.findMany({
          where: {
            sessionId: params.sessionId,
            learningObjectiveId: params.learningObjectiveId,
            knowledgeAssetId: { not: null },
          },
          select: { knowledgeAssetId: true },
          orderBy: { createdAt: "desc" },
        });
    const excludedIds = previous.flatMap((message) => message.knowledgeAssetId ? [message.knowledgeAssetId] : []);
    if (!wantsDifferent && !requestsVisual(params.studentText) && previous.length > 0) {
      return { assetId: undefined, showVisual: false };
    }
    let asset: { id: string } | null | undefined = await db.knowledgeAsset.findFirst({
      where: {
        learningObjectiveId: params.learningObjectiveId,
        status: "APPROVED",
        ...(wantsDifferent && excludedIds.length ? { id: { notIn: excludedIds } } : {}),
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    if (!asset) {
      asset = await this.internet.findAndStore(
        params.learningObjectiveId,
        wantsDifferent ? excludedIds : [],
      ).catch(() => undefined);
    }

    // Przy prośbie o inną ilustrację nie pokazujemy ponownie tej samej.
    if (wantsDifferent && !asset) return { assetId: undefined, showVisual: false };
    return { assetId: asset?.id, showVisual: Boolean(asset) || params.defaultShow };
  }
}
