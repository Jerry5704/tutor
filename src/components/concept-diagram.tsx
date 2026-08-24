import { z } from "zod";
import Image from "next/image";

const sequenceSchema = z.object({
  type: z.literal("sequence"),
  caption: z.string(),
  steps: z.array(z.object({ label: z.string(), detail: z.string() })).min(2).max(6),
});
const comparisonSchema = z.object({
  type: z.literal("comparison"),
  caption: z.string(),
  before: z.object({ label: z.string(), primary: z.number(), secondary: z.number() }),
  after: z.object({ label: z.string(), primary: z.number(), secondary: z.number() }),
  legend: z.string(),
});
const sourceImageSchema = z.object({
  type: z.literal("source-image"),
  assetId: z.string(),
  caption: z.string(),
  alt: z.string(),
  sourceLabel: z.string(),
  parts: z.array(z.object({ label: z.string(), detail: z.string() })).min(1).max(6),
});
const strandInheritanceSchema = z.object({
  type: z.literal("strand-inheritance"),
  caption: z.string(),
  parentLabel: z.string(),
  processLabel: z.string(),
  daughterLabel: z.string(),
  oldStrandLabel: z.string(),
  newStrandLabel: z.string(),
  conclusion: z.string(),
});
const diagramSchema = z.discriminatedUnion("type", [sequenceSchema, comparisonSchema, sourceImageSchema, strandInheritanceSchema]);

type VisualAsset = { key: string; caption: string; altText: string; attribution: string };

export function ConceptDiagram({ data, asset }: { data: unknown; asset?: VisualAsset }) {
  if (asset) {
    return <figure className="concept-diagram source-figure" aria-label={asset.caption}><figcaption>{asset.caption}</figcaption><Image src={`/api/source-assets/${asset.key}`} width={1680} height={1240} sizes="(max-width: 600px) 90vw, 700px" unoptimized alt={asset.altText} /><small>{asset.attribution}</small></figure>;
  }
  const parsed = diagramSchema.safeParse(data);
  if (!parsed.success) return null;
  const diagram = parsed.data;
  if (diagram.type === "source-image") {
    return <figure className="concept-diagram source-figure" aria-label={diagram.caption}><figcaption>{diagram.caption}</figcaption><Image src={`/api/source-assets/${diagram.assetId}`} width={980} height={620} sizes="(max-width: 600px) 90vw, 700px" unoptimized alt={diagram.alt} /><div className="figure-parts">{diagram.parts.map((part) => <div key={part.label}><strong>{part.label}</strong><span>{part.detail}</span></div>)}</div><small>{diagram.sourceLabel}</small></figure>;
  }
  if (diagram.type === "sequence") {
    return <figure className="concept-diagram" aria-label={diagram.caption}><figcaption>{diagram.caption}</figcaption><div className="diagram-flow">{diagram.steps.map((step, index) => <div className="diagram-stage" key={step.label}><span className="diagram-number">{index + 1}</span><strong>{step.label}</strong><small>{step.detail}</small>{index < diagram.steps.length - 1 && <span className="diagram-arrow" aria-hidden="true">→</span>}</div>)}</div></figure>;
  }
  if (diagram.type === "strand-inheritance") {
    return <figure className="concept-diagram replication-diagram" aria-label={diagram.caption}>
      <figcaption>{diagram.caption}</figcaption>
      <div className="replication-layout">
        <section className="replication-column">
          <strong>{diagram.parentLabel}</strong>
          <DnaMolecule strands={["old", "old"]} />
        </section>
        <div className="replication-process"><span aria-hidden="true">↓</span><small>{diagram.processLabel}</small><span aria-hidden="true">↓</span></div>
        <section className="replication-column">
          <strong>{diagram.daughterLabel}</strong>
          <div className="daughter-molecules"><DnaMolecule strands={["old", "new"]} /><DnaMolecule strands={["new", "old"]} /></div>
        </section>
      </div>
      <div className="strand-legend"><span><i className="dna-strand old" />{diagram.oldStrandLabel}</span><span><i className="dna-strand new" />{diagram.newStrandLabel}</span></div>
      <p className="diagram-conclusion">{diagram.conclusion}</p>
    </figure>;
  }
  return <figure className="concept-diagram" aria-label={diagram.caption}><figcaption>{diagram.caption}</figcaption><div className="comparison"><AlleleBar label={diagram.before.label} primary={diagram.before.primary} secondary={diagram.before.secondary} /><span className="big-arrow" aria-hidden="true">→</span><AlleleBar label={diagram.after.label} primary={diagram.after.primary} secondary={diagram.after.secondary} /></div><small>{diagram.legend}</small></figure>;
}

function DnaMolecule({ strands }: { strands: ["old" | "new", "old" | "new"] }) {
  return <div className="dna-molecule" aria-hidden="true">
    <span className={`dna-strand ${strands[0]}`} />
    <span className="base-pairs">••••••••••••</span>
    <span className={`dna-strand ${strands[1]}`} />
  </div>;
}

function AlleleBar({ label, primary, secondary }: { label: string; primary: number; secondary: number }) {
  const total = primary + secondary;
  const percent = total ? Math.round(primary / total * 100) : 0;
  return <div className="allele-bar"><strong>{label}</strong><div className="bar-track"><span style={{ width: `${percent}%` }} /></div><span>allel A: {percent}%</span></div>;
}
