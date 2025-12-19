import { parseJsonEventStream, uiMessageChunkSchema, type UIMessage } from "ai";

import { POST } from "@/app/api/chat/route";
import { evalCases, type EvalCase } from "@/lib/ai/evals/cases/minimal";

type EvalResult = {
  id: string;
  ok: boolean;
  output: string;
  errors: string[];
};

function buildMessages(testCase: EvalCase): UIMessage[] {
  const messages: UIMessage[] = [];
  if (testCase.system) {
    messages.push({
      id: `system-${testCase.id}`,
      role: "system",
      parts: [{ type: "text", text: testCase.system }],
    });
  }
  messages.push({
    id: `user-${testCase.id}`,
    role: "user",
    parts: [{ type: "text", text: testCase.user }],
  });
  return messages;
}

async function runCase(testCase: EvalCase): Promise<EvalResult> {
  const request = new Request(new URL("/api/chat", getBaseUrl()).toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: buildMessages(testCase),
    }),
  });

  const response = await POST(request);
  if (!response.ok || !response.body) {
    const errorText = response.body ? await response.text() : response.statusText;
    return {
      id: testCase.id,
      ok: false,
      output: "",
      errors: [`HTTP ${response.status}: ${errorText}`],
    };
  }

  let output = "";
  const reader = parseJsonEventStream({
    stream: response.body,
    schema: uiMessageChunkSchema,
  }).getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.success) {
      throw value?.error ?? new Error("Invalid stream chunk");
    }
    const chunk = value.value;
    if (chunk.type === "text-delta") {
      output += chunk.delta;
    }
    if (chunk.type === "error") {
      throw new Error(chunk.errorText);
    }
  }

  const errors: string[] = [];
  const { contains, notContains, regex } = testCase.expect;

  if (contains?.length) {
    for (const term of contains) {
      if (!output.toLowerCase().includes(term.toLowerCase())) {
        errors.push(`Missing contains: "${term}"`);
      }
    }
  }

  if (notContains?.length) {
    for (const term of notContains) {
      if (output.toLowerCase().includes(term.toLowerCase())) {
        errors.push(`Unexpected contains: "${term}"`);
      }
    }
  }

  if (regex?.length) {
    for (const pattern of regex) {
      const re = new RegExp(pattern, "i");
      if (!re.test(output)) {
        errors.push(`Regex failed: /${pattern}/i`);
      }
    }
  }

  return {
    id: testCase.id,
    ok: errors.length === 0,
    output,
    errors,
  };
}

function getBaseUrl() {
  const raw =
    process.env.EVAL_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000";

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  return `https://${raw}`;
}

async function main() {
  const results: EvalResult[] = [];
  for (const testCase of evalCases) {
    try {
      const result = await runCase(testCase);
      results.push(result);
    } catch (error) {
      results.push({
        id: testCase.id,
        ok: false,
        output: "",
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  const failed = results.filter((result) => !result.ok);
  for (const result of results) {
    const status = result.ok ? "PASS" : "FAIL";
    console.log(`${status} ${result.id}`);
    if (!result.ok) {
      console.log(`  ${result.errors.join("; ")}`);
    }
  }

  if (failed.length) {
    console.log(`\nFailed ${failed.length}/${results.length} eval(s).`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${results.length} eval(s) passed.`);
  }
}

main();
