/**
 * script to generate mODEL_pRICING from models.ts
 *
 * run: npx tsx scripts/generate-pricing.ts
 *
 * this ensures convex/pricing.ts stays in sync with lib/models.ts
 */

import { MODELS } from "../lib/models";
import * as fs from "fs";
import * as path from "path";

const OUTPUT_PATH = path.join(__dirname, "../convex/generatedPricing.ts");

function generatePricing() {
  const pricingEntries = MODELS.map(
    (model) =>
      `  "${model.id}": { input: ${model.pricing.input}, output: ${model.pricing.output} },`
  );

  const content = `/**
 * aUTO-gENERATED fILE - dO nOT eDIT dIRECTLY
 *
 * generated from lib/models.ts by scripts/generate-pricing.ts
 * run: npx tsx scripts/generate-pricing.ts
 */

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
${pricingEntries.join("\n")}
};
`;

  fs.writeFileSync(OUTPUT_PATH, content);
  console.log(`Generated ${OUTPUT_PATH}`);
}

generatePricing();
