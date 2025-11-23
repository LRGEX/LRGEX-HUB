
import { GoogleGenAI, Chat, FunctionDeclaration, Type, Part } from "@google/genai";
import { AiSettings, WidgetType } from "../types";

// --- Tool Definitions ---

const addWidgetTool: FunctionDeclaration = {
  name: "addWidget",
  description: "Create a new data widget on the dashboard. You MUST ask the user for the API Endpoint URL and the JSON path to the specific data point they want to display (e.g., 'stats.cpu') before calling this.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title of the widget" },
      endpoint: { type: Type.STRING, description: "Full URL to fetch data from" },
      jsonPath: { type: Type.STRING, description: "Dot-notation path to the data in the JSON response (e.g. 'system.cpu_usage')" },
      unit: { type: Type.STRING, description: "Unit of measurement (e.g. '%', 'MB', '°C')" },
      refreshInterval: { type: Type.NUMBER, description: "Refresh interval in milliseconds (default 5000)" }
    },
    required: ["title", "endpoint", "jsonPath"],
  },
};

const addBookmarkTool: FunctionDeclaration = {
  name: "addBookmark",
  description: "Add a website bookmark to a specific category.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      categoryName: { type: Type.STRING, description: "The name of the category." },
      title: { type: Type.STRING, description: "The display title of the link." },
      url: { type: Type.STRING, description: "The URL of the bookmark." },
    },
    required: ["categoryName", "title", "url"],
  },
};

// --- Service Interfaces ---

export interface ToolExecutors {
  addWidget: (args: { title: string; endpoint: string; jsonPath: string; unit?: string; refreshInterval?: number }) => Promise<string>;
  addBookmark: (args: { categoryName: string; title: string; url: string }) => Promise<string>;
}

// --- Gemini Implementation ---

export const sendMessageGemini = async (
  history: any[],
  message: string,
  settings: AiSettings,
  tools: ToolExecutors
): Promise<{ text: string; newHistory: any[] }> => {
  const ai = new GoogleGenAI({ apiKey: settings.geminiKey });
  
  // Use undefined if no tools needed, passing empty object can cause validation issues
  const toolConfig = settings.mode === 'COMMANDER' 
    ? { tools: [{ functionDeclarations: [addWidgetTool, addBookmarkTool] }] } 
    : undefined;

  const systemInstruction = settings.mode === 'COMMANDER'
    ? "You are the LRGEX HUB Commander. You have full control to add widgets and bookmarks. To add a widget, you MUST first ask the user for the API URL and the specific JSON field they want to track. Do not guess. Once you have the info, use the addWidget tool."
    : "You are the LRGEX AI Assistant. You are helpful and knowledgeable about coding, homelabs, and tech. You CANNOT modify the dashboard configuration. If asked to, politely refuse and suggest switching to Commander mode.";

  // SANITIZATION: Ensure history is strictly formatted for SDK to avoid ContentUnion errors
  const sanitizedHistory = history.map(h => {
    // Safely map parts, defaulting to a single text part if structure is loose
    const parts = (h.parts || []).map((p: any) => ({ 
      text: (p.text && typeof p.text === 'string' && p.text.trim() !== '') ? p.text : " " 
    }));
    
    // If no parts existed or were mapped, ensure at least one empty text part
    if (parts.length === 0) {
      parts.push({ text: " " });
    }

    return {
      role: h.role,
      parts: parts
    };
  });

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: sanitizedHistory,
    config: {
      systemInstruction,
      ...(toolConfig || {})
    },
  });

  try {
    // 1. Send the user message
    // STRICT VALIDATION: Ensure we never send empty string/undefined to sendMessage
    const safeMessage = message && message.trim().length > 0 ? message : " ";
    
    let response = await chat.sendMessage(safeMessage);
    
    // 2. Handle Function Calls loop
    while (response.functionCalls && response.functionCalls.length > 0) {
      const functionCalls = response.functionCalls;
      const functionResponses = [];

      for (const call of functionCalls) {
        const { name, args, id } = call;
        let result = "Error executing tool.";
        
        try {
          if (name === "addWidget" && tools.addWidget) {
            result = await tools.addWidget(args as any);
          } else if (name === "addBookmark" && tools.addBookmark) {
            result = await tools.addBookmark(args as any);
          } else {
            result = `Function ${name} not supported.`;
          }
        } catch (err: any) {
          result = `Error: ${err.message}`;
        }

        // Wrap result in object matching FunctionResponse interface
        functionResponses.push({
          id: id,
          name: name,
          response: { result: result },
        });
      }
      
      // 3. Send back the function responses
      // Map to Part structure: { functionResponse: ... }
      const parts = functionResponses.map(fr => ({ functionResponse: fr }));
      
      if (parts.length > 0) {
        response = await chat.sendMessage(parts);
      } else {
        break; 
      }
    }

    return { text: response.text || " ", newHistory: [] };

  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    return { text: `Gemini Error: ${error.message}`, newHistory: [] };
  }
};

// --- OpenRouter Implementation (Fetch) ---

export const sendMessageOpenRouter = async (
  history: any[],
  message: string,
  settings: AiSettings,
  tools: ToolExecutors
): Promise<{ text: string; newHistory: any[] }> => {
  
  const systemMessage = {
    role: "system",
    content: settings.mode === 'COMMANDER'
      ? "You are the LRGEX HUB Commander. You can manage the dashboard. To add a widget, ask for the URL and JSON path first. Output tool calls in OpenAI standard format."
      : "You are the LRGEX AI Assistant. You cannot modify the dashboard."
  };

  // Convert internal history to OpenAI format
  const messages: any[] = [systemMessage, ...history.map(h => ({
    role: h.role === 'model' ? 'assistant' : 'user',
    content: h.parts ? h.parts[0].text : h.text
  })), { role: "user", content: message }];

  const openAiTools = settings.mode === 'COMMANDER' ? [
    {
      type: "function",
      function: {
        name: "addWidget",
        description: "Add a widget",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            endpoint: { type: "string" },
            jsonPath: { type: "string" },
            unit: { type: "string" },
            refreshInterval: { type: "number" }
          },
          required: ["title", "endpoint", "jsonPath"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "addBookmark",
        description: "Add a bookmark",
        parameters: {
          type: "object",
          properties: {
            categoryName: { type: "string" },
            title: { type: "string" },
            url: { type: "string" }
          },
          required: ["categoryName", "title", "url"]
        }
      }
    }
  ] : undefined;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
      },
      body: JSON.stringify({
        model: settings.openRouterModel || "meta-llama/llama-3-8b-instruct:free",
        messages: messages,
        tools: openAiTools,
      })
    });

    const data = await res.json();
    
    if (data.error) throw new Error(data.error.message);

    const choice = data.choices[0];
    const msg = choice.message;

    // Handle Tool Calls
    if (msg.tool_calls) {
      messages.push(msg);

      for (const toolCall of msg.tool_calls) {
        const fnName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        let result = "";

        if (fnName === "addWidget" && tools.addWidget) {
          result = await tools.addWidget(args);
        } else if (fnName === "addBookmark" && tools.addBookmark) {
          result = await tools.addBookmark(args);
        } else {
          result = "Function not supported";
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: fnName,
          content: result
        });
      }

      const followUpRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.openRouterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: settings.openRouterModel,
          messages: messages,
        })
      });
      
      const followUpData = await followUpRes.json();
      return { text: followUpData.choices[0].message.content, newHistory: [] };
    }

    return { text: msg.content, newHistory: [] };

  } catch (e: any) {
    return { text: `OpenRouter Error: ${e.message}`, newHistory: [] };
  }
};
