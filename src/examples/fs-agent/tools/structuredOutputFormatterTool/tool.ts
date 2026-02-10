import z from "zod";

export const structuredOutputFormatterTool = {
    name: "StructuredOutputFormatter" as const,
    description: `Format your spreadsheet analysis into a structured report.
Call this tool ONCE as your final action, passing a comprehensive summary of everything you discovered about the spreadsheet (sheet names, row counts, headers, content types, etc.).`,
    schema: z.object({
        summary: z.string().describe(
            "Your complete findings about the spreadsheet"
        ),
    }),
    strict: true,
};

export type structuredOutputFormatterToolSchemaType = z.infer<typeof structuredOutputFormatterTool.schema>;
