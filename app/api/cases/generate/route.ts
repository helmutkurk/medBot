import { generateCase, saveGeneratedCase } from "../../../../lib/engine/index.ts";
import { interviewCase } from "../../../../lib/server/cases.ts";
import { engineOptions } from "../../../../lib/server/env.ts";
import { body, HttpError, json, requestSignal, route, string } from "../../../../lib/server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return route(async () => {
    const data = await body(request);
    const diagnosis = string(data.diagnosis, "diagnosis", 200);
    if (diagnosis.length < 3) throw new HttpError(400, "invalid_request", "diagnosis must contain 3–200 characters.");
    const age = data.age;
    if (age !== undefined && (typeof age !== "number" || !Number.isInteger(age) || age < 0 || age > 120)) {
      throw new HttpError(400, "invalid_request", "age must be a whole number from 0 to 120.");
    }
    const sex = data.sex;
    if (sex !== undefined && sex !== "male" && sex !== "female" && sex !== "other") {
      throw new HttpError(400, "invalid_request", "Choose male, female or other for sex.");
    }
    const setting = data.setting === undefined ? undefined : string(data.setting, "setting", 200);
    const personalityHints = data.personalityHints === undefined ? undefined : string(data.personalityHints, "personalityHints", 500);
    const result = await generateCase({ diagnosis, age, sex, setting, personalityHints }, engineOptions(requestSignal(request), "/api/cases/generate"));
    await saveGeneratedCase(result.case);
    return json({ case: interviewCase(result.case), mode: result.mode }, 201);
  });
}
