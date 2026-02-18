"use server";

import { generateVerseInsights as generateVerseInsightsFlow } from "@/ai/flows/generate-verse-insights";
import type { GenerateVerseInsightsInput, GenerateVerseInsightsOutput } from "@/ai/flows/generate-verse-insights";

// New types and action
interface SearchBibleInput {
    query: string;
    translationId: string;
}

export interface SearchResultVerse {
    id: string;
    reference: string;
    text: string;
    bookId: string;
}

interface SearchBibleOutput {
    verses: SearchResultVerse[];
}

const API_BIBLE_IDS_SEARCH: Record<string, string> = {
    CSB: 'a556c5305ee15c3f-01',
    NIV: '78a9f6124f344018-01',
    NASB: 'b8ee27bcd1cae43a-01',
    KJV: 'de4e12af7f28f599-01',
    WEB: '9879dbb7cfe39e4d-04',
};

export async function searchBible(input: SearchBibleInput): Promise<SearchBibleOutput | null> {
    const { query, translationId } = input;
    const bibleId = API_BIBLE_IDS_SEARCH[translationId as keyof typeof API_BIBLE_IDS_SEARCH];
    if (!bibleId) {
        throw new Error(`Search is not supported for the "${translationId}" translation.`);
    }
    const apiKey = process.env.NEXT_PUBLIC_API_BIBLE_KEY;
    if (!apiKey) {
        throw new Error("API key for Bible API is not configured.");
    }

    try {
        const response = await fetch(`https://rest.api.bible/v1/bibles/${bibleId}/search?query=${encodeURIComponent(query)}&sort=relevance`, {
            headers: { 'api-key': apiKey }
        });

        if (!response.ok) {
            console.error("api.bible search request failed:", response.status, response.statusText);
            const errorData = await response.json().catch(() => null);
            const message = errorData?.message || `The search service returned an error (${response.status}).`;
            throw new Error(message);
        }

        const json = await response.json();

        if (!json.data || !json.data.verses) {
            return { verses: [] };
        }

        return {
            verses: json.data.verses.map((v: any) => ({
                id: v.id,
                reference: v.reference,
                text: v.text, // Assuming the API returns HTML with <mark> tags
                bookId: v.bookId,
            }))
        };

    } catch (error) {
        console.error("Error in searchBible action:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Failed to perform search due to an unexpected error.");
    }
}


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
