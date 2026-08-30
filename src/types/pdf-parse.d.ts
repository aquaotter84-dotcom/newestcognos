declare module "pdf-parse" {
  interface PDFParseResult {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
  }
  function pdfParse(data: Buffer | Uint8Array): Promise<PDFParseResult>;
  export default pdfParse;
}
