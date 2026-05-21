import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for currency exchange
  app.post("/api/exchange-rate", async (req, res) => {
    try {
      const { currency } = req.body;
      if (!currency) {
        return res.status(400).json({ error: "La moneda de destino es requerida." });
      }

      const targetCurrency = String(currency).toUpperCase().trim();
      if (targetCurrency === "USD") {
        return res.json({ rate: 1.0 });
      }

      // Check if API key is provided
      if (!process.env.GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY not configured on the server. Returning default fallback.");
        const fallbackRate = targetCurrency === "MXN" ? 20.00 : 1.0;
        return res.json({ rate: fallbackRate, isFallback: true, message: "GEMINI_API_KEY no configurado." });
      }

      const prompt = `Calcula o busca en internet de forma precisa el tipo de cambio del dia de hoy para 1 dólar estadounidense (USD) expresado en la divisa ${targetCurrency}. Responde en formato JSON con la clave 'rate' indicando el valor numérico decimal de equivalencia.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rate: {
                type: Type.NUMBER,
                description: `El factor de conversión de 1 USD a ${targetCurrency}`
              }
            },
            required: ["rate"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("No se recibió respuesta de Gemini.");
      }

      const data = JSON.parse(text.trim());
      if (typeof data.rate !== "number" || isNaN(data.rate)) {
        throw new Error(`Invalid format returned: ${JSON.stringify(data)}`);
      }

      res.json({ rate: data.rate });
    } catch (error: any) {
      console.error("Error fetching exchange rate from Gemini:", error);
      res.status(500).json({ error: error.message || "Failed to fetch exchange rate" });
    }
  });

  // Serve static UI or Vite Dev Server
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
