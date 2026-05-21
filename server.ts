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
        return res.json({ rate: 1.0, source: "direct" });
      }

      // 1. First Attempt: Real exchange rate API (Highly reliable, fast, active)
      try {
        console.log(`Intentando consultar API de tipo de cambio directa para ${targetCurrency}...`);
        const apiResponse = await fetch("https://open.er-api.com/v6/latest/USD");
        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          if (apiData && apiData.result === "success" && apiData.rates) {
            const rawRate = apiData.rates[targetCurrency];
            if (typeof rawRate === "number" && !isNaN(rawRate)) {
              console.log(`Tipo de cambio obtenido con éxito desde API externa para ${targetCurrency}: ${rawRate}`);
              return res.json({ 
                rate: Number(rawRate.toFixed(4)), 
                source: "exchange_api",
                message: `Tipo de cambio obtenido del día para ${targetCurrency}.`
              });
            }
          }
        }
      } catch (err) {
        console.warn("La API externa de tipo de cambio falló o no está disponible. Intentando con Inteligencia Artificial...", err);
      }

      // 2. Second Attempt: Gemini AI Model with Search Grounding
      if (process.env.GEMINI_API_KEY) {
        try {
          console.log(`Consultando tipo de cambio con Inteligencia Artificial (Gemini) para ${targetCurrency}...`);
          const prompt = `Calcula o busca en internet el tipo de cambio del día de hoy exacto y actual para un dólar estadounidense (1 USD) expresado en la divisa ${targetCurrency}. Responde estrictamente con un objeto JSON válido que contenga la propiedad "rate" con el número correspondiente.`;

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
                    description: `El valor de conversión de 1 USD a ${targetCurrency}`
                  }
                },
                required: ["rate"]
              }
            }
          });

          const text = response.text;
          if (text) {
            const data = JSON.parse(text.trim());
            if (typeof data.rate === "number" && !isNaN(data.rate) && data.rate > 0) {
              console.log(`Tipo de cambio obtenido de Gemini para ${targetCurrency}: ${data.rate}`);
              return res.json({ 
                rate: Number(data.rate.toFixed(4)), 
                source: "gemini_ai",
                message: `Tipo de cambio obtenido con IA (Gemini) para ${targetCurrency}.`
              });
            }
          }
        } catch (geminiErr: any) {
          console.error("Fallo la llamada de la IA para obtener tipo de cambio:", geminiErr);
        }
      } else {
        console.warn("GEMINI_API_KEY no definida en el servidor. Pasando a valores de reserva locales.");
      }

      // 3. Third Attempt: Guess localized default fallback rates
      console.log(`Usando de tipo de cambio estático local de reserva para ${targetCurrency}...`);
      const defaultRates: Record<string, number> = {
        MXN: 20.00,
        COP: 4100.00,
        ARS: 900.00,
        CLP: 950.00,
        PEN: 3.75,
        UYU: 39.00,
        BOB: 6.90,
        CRC: 512.00,
        DOP: 59.00,
        GTQ: 7.80,
        HNL: 24.70,
        NIO: 36.80,
        PAB: 1.00,
        PYG: 7500.00,
        VES: 36.50,
        EUR: 0.92,
      };

      const fallbackRate = defaultRates[targetCurrency] || 1.0;
      return res.json({ 
        rate: fallbackRate, 
        source: "local_cache", 
        message: "Se usó un valor de referencia debido a desconexión del servidor en vivo." 
      });

    } catch (error: any) {
      console.error("Error definitivo en API de tipo de cambio:", error);
      res.status(500).json({ error: error.message || "No se pudo obtener el tipo de cambio." });
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
