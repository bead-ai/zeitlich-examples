import type { ActivityToolHandler } from "zeitlich/workflow";
import type { structuredOutputFormatterToolSchemaType } from "./tool";
import type { Spreadsheet } from "../../baml_client/types";
import { b } from "../../baml_client";

export const handleStructuredOutputFormatter: ActivityToolHandler<
  structuredOutputFormatterToolSchemaType,
  Spreadsheet
> = async (args, _context) => {
  const { summary } = args;
  const result = await b.ExtractSpreadsheet(summary);

  return {
    content: JSON.stringify(result, null, 2),
    result,
  };
};
