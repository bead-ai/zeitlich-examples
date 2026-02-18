import type { Spreadsheet } from "../../baml_client";
import { b } from "../../baml_client";

export async function structuredSummary(summary: string): Promise<Spreadsheet> {
    return b.ExtractSpreadsheet(summary);
}
