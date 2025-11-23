
import { GoogleGenAI, Chat, FunctionDeclaration, Type, Part } from "@google/genai";
import { AiSettings, WidgetType } from "../types";

// --- Tool Definitions ---

const addWidgetTool: FunctionDeclaration = {
  name: "addWidget",
  description: "Create a new widget. Supports standard JSON fetching OR custom React code execution.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title of the widget" },
      endpoint: { type: Type.STRING, description: "Full URL to fetch data from (Optional if using customCode)" },
      jsonPath: { type: Type.STRING, description: "Dot-notation path to the data (Optional if using customCode)" },
      unit: { type: Type.STRING, description: "Unit of measurement (Optional)" },
      refreshInterval: { type: Type.NUMBER, description: "Refresh interval in milliseconds" },
      headers: { type: Type.STRING, description: "JSON string of request headers" },
      customCode: { type: Type.STRING, description: "Javascript code for the React component body. Use React.createElement syntax." }
    },
    required: ["title"],
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
      iconUrl: { type: Type.STRING, description: "The URL of the icon png." },
      categoryIconUrl: { type: Type.STRING, description: "The URL of the icon png for the category itself." }
    },
    required: ["categoryName", "title", "url"],
  },
};

// --- Service Interfaces ---

export interface ToolExecutors {
  addWidget: (args: { title: string; endpoint?: string; jsonPath?: string; unit?: string; refreshInterval?: number; headers?: string; customCode?: string }) => Promise<string>;
  addBookmark: (args: { categoryName: string; title: string; url: string; iconUrl?: string; categoryIconUrl?: string }) => Promise<string>;
}

// --- Shared Helpers ---

const getSystemPrompt = (settings: AiSettings) => {
    return settings.mode === 'COMMANDER'
      ? `You are the LRGEX HUB Commander. You manage the dashboard.
         
         RULES FOR WIDGETS:
         1. **Standard Widget**: If user wants to display data from an API, use 'endpoint' and 'jsonPath'.
         2. **Custom Widget (Playground)**: If user wants a custom UI (calculator, clock, interactive tool, or specific visualization), use 'customCode'.
         
         RULES FOR CUSTOM CODE:
         - You are writing the BODY of a React functional component.
         - **NO JSX**. Browsers cannot run JSX. You MUST use \`React.createElement(type, props, ...children)\`.
         - Available Globals: \`React\`, \`useState\`, \`useEffect\`, \`useRef\`, \`Lucide\` (contains all Lucide icons).
         - **RESPONSIVENESS IS CRITICAL**: 
           - The widget container size varies (1x1, 3x2, 4x1).
           - You receive \`props.width\` and \`props.height\` (numbers in pixels). USE THEM.
           - Always use \`className: 'w-full h-full'\` for the root element.
           - Use Flexbox/Grid to center content or distribute space.
           - Example: If \`props.height < 100\`, hide detailed charts or large text.
           - Ensure text scales or wraps correctly so no clipping occurs.
         - Example Return: \`return React.createElement('div', { className: 'w-full h-full flex items-center justify-center bg-slate-900 text-white' }, \`Size: \${Math.round(props.width)}x\${Math.round(props.height)}\`);\`
         
         RULES FOR BOOKMARKS:
         1. **Categorize Intelligently**: Group items (e.g. "Media", "Development").
         2. **Generate Icons**: ALWAYS generate an 'iconUrl' using: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/{kebab-case-name}.png".
         3. **Service Name Formatting**: 'Proton Mail' -> 'proton-mail'.
         4. **Category Icons**: ALWAYS generate a 'categoryIconUrl' using the icon of the most popular app in that category.
         
         Output tool calls in the native format of the provider.`
      : "You are the LRGEX AI Assistant. You cannot modify the dashboard.";
};

const getBase64Parts = (dataUri: string) => {
    const matches = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        return null;
    }
    return {
        mimeType: matches[1],
        data: matches[2]
    };
};

// --- Gemini Implementation ---

export const sendMessageGemini = async (
  history: any[],
  message: string,
  settings: AiSettings,
  tools: ToolExecutors,
  image?: string
): Promise<{ text: string; newHistory: any[] }> => {
  const ai = new GoogleGenAI({ apiKey: settings.geminiKey });
  
  const toolConfig = settings.mode === 'COMMANDER' 
    ? { 
        tools: [
          { 
            functionDeclarations: [addWidgetTool, addBookmarkTool],
            googleSearch: {} 
          }
        ] 
      } 
    : undefined;

  const systemInstruction = getSystemPrompt(settings);

  const sanitizedHistory = history.map(h => {
    const parts = Array.isArray(h.parts) ? h.parts : [];
    const validParts = parts.map((p: any) => ({ 
      text: (p.text && typeof p.text === 'string' && p.text.trim() !== '') ? p.text : " " 
    }));
    if (validParts.length === 0) validParts.push({ text: " " });
    return { role: h.role, parts: validParts };
  });

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: sanitizedHistory,
    config: {
      systemInstruction,
      ...(toolConfig ? toolConfig : {}) 
    },
  });

  try {
    const safeMessage = message && message.trim().length > 0 ? message : " ";
    let messagePayload: any = { message: safeMessage };
    
    if (image) {
        const imgParts = getBase64Parts(image);
        if (imgParts) {
            messagePayload = {
                message: {
                    parts: [
                        { text: safeMessage },
                        { inlineData: { mimeType: imgParts.mimeType, data: imgParts.data } }
                    ]
                }
            };
        }
    }

    let response = await chat.sendMessage(messagePayload);
    
    while (response.functionCalls && response.functionCalls.length > 0) {
      const functionCalls = response.functionCalls;
      const functionResponses = [];

      for (const call of functionCalls) {
        const { name, args, id } = call;
        let result = "Error executing tool.";
        try {
          if (name === "addWidget" && tools.addWidget) result = await tools.addWidget(args as any);
          else if (name === "addBookmark" && tools.addBookmark) result = await tools.addBookmark(args as any);
          else result = `Function ${name} not supported.`;
        } catch (err: any) {
          result = `Error: ${err.message}`;
        }
        functionResponses.push({ id: id, name: name, response: { result: result } });
      }
      
      const parts = functionResponses.map(fr => ({ functionResponse: fr }));
      if (parts.length > 0) response = await chat.sendMessage({ message: parts });
      else break; 
    }

    let finalText = response.text || " ";
    const candidates = (response as any).candidates;
    const groundingMetadata = candidates?.[0]?.groundingMetadata;
    
    if (groundingMetadata?.groundingChunks) {
      const sources = groundingMetadata.groundingChunks
        .map((c: any) => c.web?.uri ? `[${c.web.title || 'Source'}](${c.web.uri})` : null)
        .filter(Boolean);
      if (sources.length > 0) finalText += `\n\n**Sources found:**\n` + sources.join('\n');
    }

    return { text: finalText, newHistory: [] };

  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    return { text: `Gemini Error: ${error.message}`, newHistory: [] };
  }
};

// --- OpenAI / OpenRouter (Compat) Implementation ---

export const sendMessageOpenAi = async (
    history: any[],
    message: string,
    settings: AiSettings,
    tools: ToolExecutors,
    isRouter: boolean = false,
    image?: string
  ): Promise<{ text: string; newHistory: any[] }> => {
    
    const apiKey = isRouter ? settings.openRouterKey : settings.openAiKey;
    const model = isRouter ? settings.openRouterModel : settings.openAiModel;
    
    const baseUrl = isRouter 
        ? "https://openrouter.ai/api/v1/chat/completions"
        : (settings.openAiUrl && settings.openAiUrl.trim() !== "") 
            ? settings.openAiUrl 
            : "https://api.openai.com/v1/chat/completions";
  
    const systemMessage = {
      role: "system",
      content: getSystemPrompt(settings)
    };
  
    const messages: any[] = [systemMessage, ...history.map(h => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.parts ? h.parts[0].text : h.text
    }))];
    
    if (image) {
        messages.push({
            role: "user",
            content: [
                { type: "text", text: message },
                { type: "image_url", image_url: { url: image } }
            ]
        });
    } else {
        messages.push({ role: "user", content: message });
    }
  
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
              refreshInterval: { type: "number" },
              headers: { type: "string" },
              customCode: { type: "string" }
            },
            required: ["title"]
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
              url: { type: "string" },
              iconUrl: { type: "string" },
              categoryIconUrl: { type: "string" }
            },
            required: ["categoryName", "title", "url"]
          }
        }
      }
    ] : undefined;
  
    try {
      const headers: any = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      };

      if (isRouter) {
          headers["HTTP-Referer"] = window.location.origin;
      }
  
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          model: model || (isRouter ? "meta-llama/llama-3-8b-instruct:free" : "gpt-4o"),
          messages: messages,
          tools: openAiTools,
        })
      });
  
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
  
      const choice = data.choices[0];
      const msg = choice.message;
  
      if (msg.tool_calls) {
        messages.push(msg);
  
        for (const toolCall of msg.tool_calls) {
          const fnName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);
          let result = "";
  
          if (fnName === "addWidget" && tools.addWidget) result = await tools.addWidget(args);
          else if (fnName === "addBookmark" && tools.addBookmark) result = await tools.addBookmark(args);
          else result = "Function not supported";
  
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: fnName,
            content: result
          });
        }
  
        const followUpRes = await fetch(baseUrl, {
          method: "POST",
          headers: headers,
          body: JSON.stringify({
            model: model,
            messages: messages,
          })
        });
        
        const followUpData = await followUpRes.json();
        return { text: followUpData.choices[0].message.content, newHistory: [] };
      }
  
      return { text: msg.content, newHistory: [] };
  
    } catch (e: any) {
      return { text: `${isRouter ? 'OpenRouter' : 'OpenAI'} Error: ${e.message}`, newHistory: [] };
    }
  };

// --- Ollama Implementation ---

export const sendMessageOllama = async (
    history: any[],
    message: string,
    settings: AiSettings,
    tools: ToolExecutors,
    image?: string
  ): Promise<{ text: string; newHistory: any[] }> => {
    
    const baseUrl = settings.ollamaUrl || "http://localhost:11434";
    const model = settings.ollamaModel || "llama3";
    const compatUrl = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    
    const tempSettings: AiSettings = {
        ...settings,
        openAiKey: "ollama", 
        openAiModel: model,
        openAiUrl: compatUrl
    };

    return sendMessageOpenAi(history, message, tempSettings, tools, false, image);
};
