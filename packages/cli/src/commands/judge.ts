import { resolve } from 'node:path'
import { judgeFile } from '../semantic/judge.js'
import { formatSemanticReview } from '../semantic/format.js'

// `keel judge <file>` — runs the semantic LLM-as-judge tier on one file,
// catching naming/logic/comment/security issues structural rules can't see.
export async function runJudge(projectRoot: string, fileArg?: string): Promise<void> {
  if (!fileArg) {
    console.error('Usage: keel judge <file>')
    process.exitCode = 1
    return
  }

  const absPath = resolve(projectRoot, fileArg)
  const review = await judgeFile(absPath, projectRoot)
  console.log(formatSemanticReview(review))

  if (!review.analyzed) process.exitCode = 1
}
