
import { GoogleGenAI, Type } from "@google/genai";
import { DashboardData } from "../types";

export const analyzeDataWithGemini = async (data: DashboardData): Promise<string> => {
  // Use process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Sample data to keep tokens low while providing context
  const sampleData = data.rows.slice(0, 10);
  const columnSummary = Object.keys(data.types).map(k => `${k} (${data.types[k]})`).join(', ');

  const prompt = `
    Analyze the following data summary from a user's spreadsheet.
    Columns: ${columnSummary}
    Row count: ${data.rows.length}
    Sample Data (first 10 rows): ${JSON.stringify(sampleData)}

    Provide a concise analysis in Portuguese focusing on:
    1. Key trends or anomalies discovered.
    2. A brief business summary.
    3. Three actionable recommendations based on the numbers.
    
    Format the output in professional Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.95,
      }
    });

    return response.text || "Não foi possível gerar insights no momento.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Erro ao processar análise inteligente. Verifique sua conexão ou volume de dados.";
  }
};
