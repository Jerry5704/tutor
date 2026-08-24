import { optionsFromArgs, runEvaluationLab } from "./evaluation-lab";
import { db } from "../src/server/db/client";

async function main() {
  const report = await runEvaluationLab(optionsFromArgs(process.argv.slice(2)));
  console.log(`Evaluation complete: ${report.paths.html}`);
  console.log(`Result: passed=${report.summary.passed}/${report.summary.runs}, completed=${report.summary.completed}/${report.summary.runs}, highIssues=${report.summary.highIssues}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
