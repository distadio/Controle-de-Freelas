
import { GoogleGenAI } from "@google/genai";
import { Freela } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // In a real app, you might want to handle this more gracefully.
  // For this context, we assume the key is provided.
  console.warn("Gemini API key not found in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const formatDataForPrompt = (data: Freela[]): string => {
    const summary = data.map(f => ({
        date: f.data_evento,
        value: f.valor,
        category: f.categoria,
        service_type: f.tipo_servico,
        client: f.contratante || 'N/A',
        paid: f.status === 'pago'
    }));
    return JSON.stringify(summary, null, 2);
};

export const generateDashboardInsights = async (yearlyData: Freela[]): Promise<string> => {
    if (!API_KEY) {
        return "API Key not configured. Please set up your environment variable to use AI insights.";
    }

    if (yearlyData.length < 3) {
        return "Adicione mais alguns freelas (pelo menos 3) este ano para que a IA possa gerar insights mais relevantes e precisos sobre seu negócio.";
    }

    const model = 'gemini-2.5-flash';
    const formattedData = formatDataForPrompt(yearlyData);
    
    const prompt = `
        Você é um consultor de negócios especialista em carreiras para freelancers no setor de eventos e audiovisual no Brasil.
        Analise os seguintes dados de freelas de um ano e forneça insights estratégicos em formato Markdown.
        
        Os insights devem ser acionáveis e focados em:
        1.  **Análise de Sazonalidade:** Identifique os meses de pico e de baixa. Sugira como aproveitar os picos e como se preparar para as baixas (ex: prospecção, cursos).
        2.  **Diversificação de Serviços e Clientes:** Comente sobre a variedade de categorias de serviço e contratantes. Há dependência de algum cliente ou tipo de serviço? Sugira oportunidades de diversificação ou especialização.
        3.  **Precificação e Valor:** Analise o ticket médio. Sugira estratégias para aumentar o valor percebido e o ticket médio (ex: pacotes de serviço, upsell).
        4.  **Fidelização de Clientes:** Analise a recorrência de contratantes. Dê dicas de como aumentar a fidelização.
        
        Seja conciso, direto e use uma linguagem motivadora e profissional. Formate a resposta usando títulos, listas e negrito. Não inclua o JSON de dados na sua resposta.

        Aqui estão os dados:
        ${formattedData}
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return "Ocorreu um erro ao gerar os insights. Verifique sua conexão e a chave da API. Tente novamente mais tarde.";
    }
};
