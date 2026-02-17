import { GoogleGenAI } from "@google/genai";

// Initialize Gemini API Client with Vite environment variable
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export const generateAgdiBackground = async (prompt: string): Promise<string> => {
  try {
    // Using gemini-2.5-flash-image for standard fast generation
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        // We don't use responseMimeType here for images in this specific model call structure 
        // unless using generateImages, but generateContent is preferred for the multi-modal endpoint
      }
    });

    // Extract image
    // The response structure for images in generateContent can vary, we look for inlineData or executable code 
    // Usually for 'gemini-2.5-flash-image' it returns an inlineData part.

    // Iterate through parts to find the image
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) throw new Error("No content generated");

    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};