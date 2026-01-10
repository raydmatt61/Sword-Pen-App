"use server";

import { generateVerseInsights as generateVerseInsightsFlow } from "@/ai/flows/generate-verse-insights";
import type { GenerateVerseInsightsInput, GenerateVerseInsightsOutput } from "@/ai/flows/generate-verse-insights";

export async function generateVerseInsights(input: GenerateVerseInsightsInput): Promise<GenerateVerseInsightsOutput> {
  // In a real application, you might add user authentication checks here.
  try {
    const insights = await generateVerseInsightsFlow(input);
    return insights;
  } catch (error) {
    console.error("Error generating verse insights:", error);
    // Re-throw or handle the error as appropriate for your application
    throw new Error("Failed to generate AI insights.");
  }
}
