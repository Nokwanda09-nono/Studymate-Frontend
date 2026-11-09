import JSZip from "jszip";
import { Buffer } from "buffer";




/** Convert a zip entry (file) to a base64 data‑url string */
async function zipEntryToDataUrl(entry: JSZip.JSZipObject): Promise<string> {
  const arrayBuffer = await entry.async("arraybuffer");
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const ext = entry.name.split('.').pop()?.toLowerCase() ?? "png";
  const mime = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    bmp: "image/bmp",
    tif: "image/tiff",
    tiff: "image/tiff",
  }[ext] ?? "image/png";
  return `data:${mime};base64,${base64}`;
}

/** Build a map of relationship ids (rIdX) → media file paths for a given slide */
async function getSlideImageMap(zip: JSZip, slideNum: number): Promise<Record<string, string>> {
  const relPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
  const relFile = zip.file(relPath);
  if (!relFile) return {};
  const relXml = await relFile.async("string");
  const map: Record<string, string> = {};
  const relRegex = /<Relationship\s+Id="([^\"]+)"[^>]*Target="([^\"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = relRegex.exec(relXml))) {
    const [, id, target] = m;
    map[id] = `ppt/${target}`;
  }
  return map;
}



export interface SlideData {
  slideNumber: number;
  title: string;
  lines: string[];
  notes?: string;
  rawText?: string;
  /**
   * Base64-encoded data URLs of images embedded in the slide.
   * Example: "data:image/png;base64,iVBORw0KG..."
   */
  imageDataUrls?: string[];
}


/**
 * Parses raw PPTX bytes (ArrayBuffer) directly using JSZip.
 * Extracts slides in order, extracting slide titles, bullet points/paragraphs, and speaker notes.
 */
export async function parsePptxArrayBuffer(arrayBuffer: ArrayBuffer): Promise<SlideData[]> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const slideFiles = Object.keys(zip.files)
      .filter((filename) => /^ppt\/slides\/slide\d+\.xml$/i.test(filename))
      .sort((a, b) => {
        const numA = Number.parseInt(a.match(/\d+/)?.[0] || "0", 10);
        const numB = Number.parseInt(b.match(/\d+/)?.[0] || "0", 10);
        return numA - numB;
      });

    if (slideFiles.length === 0) {
      return [];
    }

    const slides: SlideData[] = [];

    for (let i = 0; i < slideFiles.length; i++) {
      const slidePath = slideFiles[i];
      const slideNum = Number.parseInt(slidePath.match(/\d+/)?.[0] || `${i + 1}`, 10);
      const xmlText = await zip.files[slidePath].async("string");

      const shapes = xmlText.match(/<p:sp[\s>][\s\S]*?<\/p:sp>/gi) || [];
      let slideTitle = "";
      const slideLines: string[] = [];

      for (const shape of shapes) {
        const isTitleShape =
          /<p:ph[^>]*type="(title|ctrTitle)"/i.test(shape) ||
          /<p:ph[^>]*idx="0"/i.test(shape);

        const paragraphs = shape.match(/<a:p[\s>][\s\S]*?<\/a:p>/gi) || [];
        for (const pXml of paragraphs) {
          const tMatches = pXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi) || [];
          const text = tMatches
            .map((t) => t.replace(/<[^>]+>/g, ""))
            .join("")
            .trim();

          if (text) {
            if (isTitleShape && !slideTitle) {
              slideTitle = text;
            } else {
              slideLines.push(text);
            }
          }
        }
      }

      // Fallback if shapes weren't parsed
      if (slideLines.length === 0 && !slideTitle) {
        const fallbackMatches = xmlText.match(/<a:t[^>]*>(.*?)<\/a:t>/gi) || [];
        const rawLines = fallbackMatches
          .map((m) => m.replace(/<[^>]+>/g, "").trim())
          .filter(Boolean);
        if (rawLines.length > 0) {
          slideTitle = rawLines[0];
          slideLines.push(...rawLines.slice(1));
        }
      }

      // Check for speaker notes
      let notes: string | undefined = undefined;
      const notesFile = `ppt/notesSlides/notesSlide${slideNum}.xml`;
      if (zip.files[notesFile]) {
        try {
          const notesXml = await zip.files[notesFile].async("string");
          const notesMatches = notesXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi) || [];
          const notesText = notesMatches
            .map((t) => t.replace(/<[^>]+>/g, "").trim())
            .filter(Boolean)
            .join(" ");
          if (notesText && notesText.length > 5) {
            notes = notesText;
          }
        } catch (_) {}
      }

      const finalTitle = slideTitle.trim() || `Slide ${i + 1}`;
       // Resolve images for this slide
      const imageMap = await getSlideImageMap(zip, slideNum);
      const blipMatches = xmlText.match(/<a:blip[^>]*r:embed="([^\"]+)"[^>]*>/gi) || [];
      const imageUrls: string[] = [];
      for (const blip of blipMatches) {
        const rIdMatch = /r:embed="([^\"]+)"/i.exec(blip);
        if (!rIdMatch) continue;
        const rId = rIdMatch[1];
        const mediaPath = imageMap[rId];
        if (mediaPath && zip.file(mediaPath)) {
          imageUrls.push(await zipEntryToDataUrl(zip.file(mediaPath)!));
        }
      }

      slides.push({
        slideNumber: i + 1,
        title: finalTitle,
        lines: slideLines.length > 0 ? slideLines : ["No text content on this slide."],
        notes,
        rawText: `${finalTitle}\n${slideLines.join("\n")}`,
        imageDataUrls: imageUrls.length ? imageUrls : undefined,
      });
    }

    return slides;
  } catch (error) {
    console.warn("Client-side PPTX parsing error:", error);
    return [];
  }
}

/**
 * Parses slides from formatted text returned from the backend (e.g., "--- Slide 1: Title ---\n...").
 */
export function parseSlidesFromText(rawText: string): SlideData[] {
  if (!rawText) return [];

  const slideParts = rawText
    .split(/(?:^|\n)(?:---|\*\*\*|===)?\s*(?:Slide|Page)\s*\d+[:\s-]*/i)
    .filter((p) => p.trim().length > 0);

  if (slideParts.length > 1) {
    return slideParts.map((part, index) => {
      let notes: string | undefined = undefined;
      let textBody = part;

      const notesMatch = part.match(/\[Notes?:\s*([\s\S]*?)\]/i);
      if (notesMatch) {
        notes = notesMatch[1].trim();
        textBody = part.replace(notesMatch[0], "").trim();
      }

      const lines = textBody
        .split("\n")
        .map((l) => l.replace(/^[•\-\*]\s*/, "").trim())
        .filter(Boolean);

      const title = lines[0]?.replace(/^:\s*/, "").trim() || `Slide ${index + 1}`;
      const bodyLines = lines.slice(1).length > 0 ? lines.slice(1) : lines;

      return {
        slideNumber: index + 1,
        title,
        lines: bodyLines,
        notes,
        rawText: textBody,
      };
    });
  }

  // Fallback to paragraph splitting if no slide markers exist
  const paragraphs = rawText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length > 1) {
    return paragraphs.map((p, index) => {
      const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
      return {
        slideNumber: index + 1,
        title: lines[0] || `Slide ${index + 1}`,
        lines: lines.slice(1).length > 0 ? lines.slice(1) : lines,
        rawText: p,
      };
    });
  }

  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  return [
    {
      slideNumber: 1,
      title: lines[0] || "Presentation Slide 1",
      lines: lines.slice(1).length > 0 ? lines.slice(1) : lines,
      rawText,
    },
  ];
}

