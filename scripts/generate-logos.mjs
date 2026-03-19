#!/usr/bin/env node
/**
 * Generate Ninken logo images using Gemini gemini-3-pro-image-preview model
 * Outputs: badge (sidebar icon), logo (landing page), banner (README)
 */
import fs from "fs";
import path from "path";

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCFnFzeFPO_M5MnsocBgTh2YOnGcttjEGY";
const MODEL = "gemini-3-pro-image-preview";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
const OUT_DIR = path.resolve("images");

async function generateImage(prompt, filename) {
  console.log(`\n--- Generating: ${filename} ---`);
  console.log(`Prompt: ${prompt.slice(0, 120)}...`);

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`API error (${res.status}):`, err);
    return false;
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    if (part.inlineData) {
      const ext = part.inlineData.mimeType?.includes("png") ? "png" : "png";
      const outPath = path.join(OUT_DIR, filename);
      fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, "base64"));
      console.log(`Saved: ${outPath} (${fs.statSync(outPath).size} bytes)`);
      return true;
    }
    if (part.text) {
      console.log(`Text response: ${part.text}`);
    }
  }

  console.error("No image data in response");
  return false;
}

const COLORS = `
Background: #1a1a1a (very dark, near black)
Secondary bg: #1e1e1e (sidebar dark)
Accent red: #dc2626 (eyes, highlights)
Text: #e6e6e6 (light gray)
`;

const prompts = [
  {
    filename: "ninken-badge.png",
    prompt: `Create a minimal, stylized ninja dog face icon suitable for a small app sidebar icon.

CRITICAL design requirements:
- TRANSPARENT background (no background color at all, fully transparent/alpha)
- The dog face must be LIGHT colored — use white (#ffffff) and light gray (#c0c0c0) for the main shapes so it stands out on a very dark UI
- Glowing red eyes (#dc2626) — the signature accent, make them bright and prominent
- Red outline or red accent strokes around the face edges
- Simple geometric/flat vector style — minimal detail, must be readable at 24x24 pixels
- Front-facing dog/wolf/hound face only (no body)
- Sharp pointed ears, angular jaw — stealth/ninja aesthetic
- NO text, NO background, NO extra decorations
- Think: a clean white wolf icon with red eyes on transparent background
- Format: square, icon-style, suitable for favicon or sidebar badge`,
  },
  {
    filename: "ninken-logo.png",
    prompt: `Create a professional cybersecurity tool logo featuring a ninja dog/hound.

Design requirements:
- A sleek, stylized ninja dog (hound) in a dynamic but composed pose — alert, ready to hunt
- Dark color palette: background #1a1a1a, the dog in shades of dark gray and charcoal
- Glowing red eyes (#dc2626) — signature detail, menacing but professional
- The text "Ninken" in bold modern sans-serif font, light gray (#e6e6e6), positioned beside or below the dog
- Japanese characters "忍犬" in small red (#dc2626) text near the brand name
- Tagline "Track. Hunt. Retrieve." in small uppercase tracking text, muted red
- Professional cybersecurity/red-team aesthetic
- Clean composition, suitable for a dark-themed landing page
- Landscape/wide format (roughly 3:1 or 4:1 aspect ratio)
- NO busy backgrounds — solid dark #1a1a1a with subtle vignette at most`,
  },
  {
    filename: "ninken-banner.png",
    prompt: `Create a professional GitHub README banner image for "Ninken" — a cybersecurity red team toolkit.

Design requirements:
- Wide banner format (roughly 3:1 aspect ratio, like 1200x400)
- Dark background: #1a1a1a with very subtle dark geometric patterns or grid lines
- Left side: a stylized ninja dog/hound silhouette or face with glowing red eyes (#dc2626)
- Center/right: "Ninken" in large bold modern font, light gray (#e6e6e6)
- Below the name: "忍犬" in red (#dc2626) Japanese characters
- Tagline: "Track. Hunt. Retrieve." in small uppercase, muted red/gray
- Professional, polished, suitable for an open-source security tool
- Think: RedAmon, Origami security tools — clean, dark, intimidating but professional
- Subtle tech elements: faint circuit lines, network nodes, or grid — all in very dark gray, not distracting
- NO bright colors except the red accents
- High quality, suitable for GitHub README header`,
  },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const { filename, prompt } of prompts) {
    let success = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      success = await generateImage(prompt, filename);
      if (success) break;
      console.log(`Retry ${attempt}...`);
    }
    if (!success) {
      console.error(`FAILED to generate ${filename}`);
    }
  }
  console.log("\nDone!");
}

main().catch(console.error);
