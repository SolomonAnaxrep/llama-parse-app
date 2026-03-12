import { LlamaCloud } from "@llamaindex/llama-cloud";
import type { ExtractConfig } from "@llamaindex/llama-cloud/resources/extraction/runs";

export interface CitationBox {
  p: number | null;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
}

export interface ExtractedFieldResult {
  field: string; // The field name (last part of path)
  fieldPath: string; // The full path in LlamaIndex's return statement (e.g., "property_data.address")
  value: unknown;
  confidence: number | null;
  citations: CitationBox[];
  fileId?: string | null; // UUID of the file this field was extracted from
}

export interface LlamaParseExtractionResult {
  data: Record<string, unknown>; // Raw extracted data from LlamaIndex
  extractionMetadata: {
    fieldMetadata: Record<string, any>;
    usage?: {
      numPagesExtracted?: number;
      numDocumentTokens?: number;
      numOutputTokens?: number;
    };
  };
  fields: ExtractedFieldResult[]; // Flattened field results with confidence and citations
  rawResult: unknown; // Complete raw response from LlamaIndex
  processTimeMs: number;
}

export interface LlamaParseExtractionOptions {
  apiKey?: string; // If not provided, will use LLAMAPARSE_API_KEY env var
  schema: Record<string, unknown>; // JSON schema for extraction
  extractionTarget?: ExtractConfig["extraction_target"];
  extractionMode?: ExtractConfig["extraction_mode"];
  chunkMode?: ExtractConfig["chunk_mode"];
  citeSources?: boolean;
  citationBbox?: boolean;
  confidenceScores?: boolean;
  timeout?: number; // Timeout in seconds (default: 2700)
  pollingInterval?: number; // Polling interval in seconds (default: 15)
}

export class LlamaParseExtractionService {
  async extractFromPdf(
    fileBuffer: Buffer,
    fileName: string,
    options: LlamaParseExtractionOptions
  ): Promise<LlamaParseExtractionResult> {
    const apiKey = options.apiKey || process.env.LLAMAPARSE_API_KEY;
    if (!apiKey) {
      throw new Error("LLAMAPARSE_API_KEY is not configured. Provide it via options.apiKey or environment variable.");
    }

    const client = new LlamaCloud({ apiKey });
    const schema = options.schema;

    const startedAt = Date.now();
    const config: ExtractConfig = {
      extraction_target: options.extractionTarget || "PER_DOC",
      extraction_mode: options.extractionMode || "BALANCED",
      chunk_mode: options.chunkMode || "PAGE",
      cite_sources: options.citeSources !== false,
      citation_bbox: options.citationBbox !== false,
      confidence_scores: options.confidenceScores !== false,
    };

    const safeFileName = this.ensurePdfFileName(fileName);
    
    // Log what we're sending to Llama
    console.log(`[LlamaParseExtractionService] Starting extraction for file: ${safeFileName}`);
    console.log(`[LlamaParseExtractionService] File size: ${fileBuffer.length} bytes`);
    console.log(`[LlamaParseExtractionService] Config:`, JSON.stringify(config, null, 2));
    
    // Analyze schema size and structure
    const schemaAnalysis = this.analyzeSchema(schema);
    console.log(`[LlamaParseExtractionService] Schema analysis:`, JSON.stringify(schemaAnalysis, null, 2));
    
    // Warn if schema might exceed Llama's limits
    if (schemaAnalysis.maxDepth > 5) {
      console.warn(`[LlamaParseExtractionService] ⚠️ WARNING: Schema nesting depth (${schemaAnalysis.maxDepth}) exceeds Llama's limit of 5 levels!`);
    }
    if (schemaAnalysis.totalKeys > 1000) {
      console.warn(`[LlamaParseExtractionService] ⚠️ WARNING: Schema has ${schemaAnalysis.totalKeys} keys, which may exceed Llama's limits!`);
    }
    
    // Convert buffer to base64 for the new API
    const base64Data = fileBuffer.toString('base64');
    
    // The extract() method handles polling internally
    const pollingTimeout = options.timeout || 2700; // Default: 45 minutes
    const pollingInterval = options.pollingInterval || 15; // Default: 15 seconds
    console.log(`[LlamaParseExtractionService] Using built-in polling with ${pollingTimeout}s timeout`);
    
    const result = await client.extraction.extract({
      config,
      data_schema: schema as any, // Schema type is compatible but TypeScript needs cast
      file: {
        data: base64Data,
        mime_type: "application/pdf",
      },
    }, {
      timeout: pollingTimeout,
      pollingInterval,
    });
    
    const processTimeMs = Date.now() - startedAt;

    console.log(`[LlamaParseExtractionService] Extraction completed in ${processTimeMs}ms`);
    console.log(`[LlamaParseExtractionService] Result keys:`, Object.keys(result || {}).join(", "));

    // The new API returns JobGetResultResponse directly
    // Structure: { data: {...}, extraction_metadata: {...} }
    const rawData = (result?.data ?? {}) as Record<string, unknown>;
    const extractionMetadata = (result?.extraction_metadata as any) || {};
    const fieldMetadataMap = extractionMetadata.field_metadata;
    const fields = this.extractFieldResults(rawData, fieldMetadataMap);

    return {
      data: rawData,
      extractionMetadata: {
        fieldMetadata: fieldMetadataMap || {},
        usage: extractionMetadata.usage,
      },
      fields,
      rawResult: result,
      processTimeMs,
    };
  }

  extractCitations(fieldMetadata: any): CitationBox[] {
    const citations = Array.isArray(fieldMetadata?.citation) ? fieldMetadata.citation : [];
    return citations.map((c: any) => {
      const page = typeof c?.page === "number" ? c.page : null;
      
      // LlamaIndex returns bbox coordinates in bounding_boxes array when citation_bbox: true
      // The bounding_boxes array contains bbox objects with coordinates
      
      let x: number | null = null;
      let y: number | null = null;
      let w: number | null = null;
      let h: number | null = null;
      
      // Extract from bounding_boxes array (LlamaIndex format with citation_bbox: true)
      if (Array.isArray(c?.bounding_boxes) && c.bounding_boxes.length > 0) {
        // Use the first bounding box
        const bbox = c.bounding_boxes[0];
        x = this.num(bbox?.x ?? bbox?.x1);
        y = this.num(bbox?.y ?? bbox?.y1);
        
        // If width/height are provided directly
        if (bbox?.width != null || bbox?.w != null) {
          w = this.num(bbox.width ?? bbox.w);
          h = this.num(bbox.height ?? bbox.h);
        }
        // If x2/y2 are provided, calculate width/height
        else if (bbox?.x2 != null && x != null) {
          const x2 = this.num(bbox.x2);
          if (x2 != null) {
            w = x2 - x;
          }
          if (bbox?.y2 != null && y != null) {
            const y2 = this.num(bbox.y2);
            if (y2 != null) {
              h = y2 - y;
            }
          }
        }
      }
      
      return { p: page, x, y, w, h };
    });
  }

  private extractFieldResults(
    data: Record<string, unknown>,
    fieldMetadataMap: Record<string, any> | undefined
  ): ExtractedFieldResult[] {
    const out: ExtractedFieldResult[] = [];

    if (!data || typeof data !== "object") {
      return out;
    }

    const metadata = fieldMetadataMap || {};
    this.extractFieldResultsRecursciveStep(data, metadata, "", out);

    return out;
  }

  private extractFieldResultsRecursciveStep(
    data: Record<string, unknown> | Array<unknown>,
    metadata: Record<string, unknown> | Array<unknown> | undefined,
    path: string,
    out: ExtractedFieldResult[],
  ): void {
    // Handle arrays
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        const itemMetadata = Array.isArray(metadata) 
          ? metadata[index] 
          : (metadata && typeof metadata === "object" && String(index) in metadata)
          ? (metadata as any)[String(index)]
          : undefined;
        
        const itemPath = path ? `${path}[${index}]` : `[${index}]`;
        
        if (item === null || item === undefined) {
          return;
        }
        
        if (typeof item === "object" && !Array.isArray(item)) {
          this.extractFieldResultsRecursciveStep(item as Record<string, unknown>, itemMetadata as Record<string, unknown> | undefined, itemPath, out);
        } else if (Array.isArray(item)) {
          this.extractFieldResultsRecursciveStep(item, itemMetadata as Array<unknown> | undefined, itemPath, out);
        } else {
          // Leaf value in array
          const fieldName = itemPath.split(".").pop()?.replace(/\[\d+\]$/, "") || itemPath;
          const confidence = itemMetadata && typeof itemMetadata === "object" && "confidence" in itemMetadata 
            ? this.num((itemMetadata as any).confidence) 
            : null;
          const citations = this.extractCitations(itemMetadata);
          
          out.push({
            field: fieldName,
            fieldPath: itemPath,
            value: item,
            confidence,
            citations,
          });
        }
      });
      return;
    }

    // Handle objects
    if (data && typeof data === "object") {
      Object.entries(data).forEach(([key, value]) => {
        const fieldMetadata = metadata && typeof metadata === "object" && key in metadata
          ? (metadata as any)[key]
          : undefined;
        
        const fieldPath = path ? `${path}.${key}` : key;
        
        if (value === null || value === undefined) {
          return;
        }
        
        if (typeof value === "object" && !Array.isArray(value)) {
          // Nested object - recurse
          this.extractFieldResultsRecursciveStep(value as Record<string, unknown>, fieldMetadata as Record<string, unknown> | undefined, fieldPath, out);
        } else if (Array.isArray(value)) {
          // Array - recurse
          this.extractFieldResultsRecursciveStep(value, fieldMetadata as Array<unknown> | undefined, fieldPath, out);
        } else {
          // Leaf value
          const confidence = fieldMetadata && typeof fieldMetadata === "object" && "confidence" in fieldMetadata
            ? this.num((fieldMetadata as any).confidence)
            : null;
          const citations = this.extractCitations(fieldMetadata);
          
          out.push({
            field: key,
            fieldPath,
            value,
            confidence,
            citations,
          });
        }
      });
    }
  }

  private num(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  private ensurePdfFileName(fileName: string): string {
    const trimmed = (fileName || "").trim();
    if (!trimmed) return `deal-v3-upload-${Date.now()}.pdf`;
    return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
  }

  /**
   * Analyze schema structure to check against Llama's limits:
   * - Max nesting depth: 5 levels
   * - Key count restrictions (exact limit not specified in docs)
   */
  private analyzeSchema(schema: Record<string, unknown>): {
    totalKeys: number;
    maxDepth: number;
    schemaSizeBytes: number;
    topLevelKeys: number;
  } {
    let totalKeys = 0;
    let maxDepth = 0;
    
    const countKeys = (obj: unknown, depth: number = 0): void => {
      if (depth > maxDepth) maxDepth = depth;
      
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        const entries = Object.entries(obj);
        totalKeys += entries.length;
        
        for (const [key, value] of entries) {
          // Skip description fields (they're just strings)
          if (key === "description" && typeof value === "string") continue;
          
          // Recursively count nested objects
          if (value && typeof value === "object") {
            if (key === "properties" || key === "items") {
              countKeys(value, depth + 1);
            } else if (Array.isArray(value)) {
              // For arrays, check items schema
              value.forEach((item) => {
                if (item && typeof item === "object") {
                  countKeys(item, depth + 1);
                }
              });
            } else {
              countKeys(value, depth + 1);
            }
          }
        }
      }
    };
    
    countKeys(schema);
    
    const schemaJson = JSON.stringify(schema);
    const schemaSizeBytes = Buffer.byteLength(schemaJson, "utf8");
    const topLevelKeys = schema.properties ? Object.keys(schema.properties as Record<string, unknown>).length : 0;
    
    return {
      totalKeys,
      maxDepth,
      schemaSizeBytes,
      topLevelKeys,
    };
  }
}

