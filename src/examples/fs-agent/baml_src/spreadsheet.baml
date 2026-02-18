class Table {
    headers string[] @description("Column header names from the first row of the table")
    data_rows int @description("Number of data rows, excluding the header row")
    description string? @description("Brief description of the data in the table, e.g. 'billing/invoice records'")
}

class Sheet {
    title string @description("Sheet name as shown in the spreadsheet tab")
    total_cols int @description("Total number of columns with any content")
    total_rows int @description("Total number of rows with any content, including headers")
    content_type string @description("Type of content: 'tabular', 'image', 'mixed', or 'empty'")
    tables Table[] @description("Tables found in this sheet. Empty if the sheet has no tabular data.")
}

class Spreadsheet {
    sheets Sheet[] @description("All sheets in the workbook")
    brief_summary string @description("One-sentence summary of the spreadsheet's overall contents")
}

function ExtractSpreadsheet(spreadsheet: string) -> Spreadsheet {
    client CustomOpus4
    prompt #"
    Extract from this content:
    {{ spreadsheet }}

    {{ ctx.output_format }}
  "#
}
