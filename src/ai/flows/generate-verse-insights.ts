'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating AI insights for a selected verse based on user annotations.
 *
 * - generateVerseInsights - A function that takes a verse and annotations as input and returns AI-generated insights.
 * - GenerateVerseInsightsInput - The input type for the generateVerseInsights function.
 * - GenerateVerseInsightsOutput - The return type for the generateVerseInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateVerseInsightsInputSchema = z.object({
  verse: z.string().describe('The Bible verse to analyze.'),
  annotations: z.string().describe('User annotations for the verse.'),
});
export type GenerateVerseInsightsInput = z.infer<typeof GenerateVerseInsightsInputSchema>;

const GenerateVerseInsightsOutputSchema = z.object({
  insights: z.string().describe('AI-generated insights for the verse based on user annotations.'),
});
export type GenerateVerseInsightsOutput = z.infer<typeof GenerateVerseInsightsOutputSchema>;

export async function generateVerseInsights(input: GenerateVerseInsightsInput): Promise<GenerateVerseInsightsOutput> {
  return generateVerseInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateVerseInsightsPrompt',
  input: {schema: GenerateVerseInsightsInputSchema},
  output: {schema: GenerateVerseInsightsOutputSchema},
  prompt: `You are a Bible scholar providing insights on a given verse based on user annotations.

Verse: {{{verse}}}

User Annotations: {{{annotations}}}

Provide insightful interpretations and explanations of the verse, taking into account the user's annotations. Focus on providing unique and thought-provoking perspectives.
`,
});

const generateVerseInsightsFlow = ai.defineFlow(
  {
    name: 'generateVerseInsightsFlow',
    inputSchema: GenerateVerseInsightsInputSchema,
    outputSchema: GenerateVerseInsightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
