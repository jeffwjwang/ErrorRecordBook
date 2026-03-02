import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface AIAnalysisResult {
  title: string;
  tags: string[];
  questionText: string;
  comparison: {
    studentAnswer: string;
    standardAnswer: string;
    gapAnalysis: string;
  };
  isCorrect: boolean;
  solution: string;
  errorRoot: {
    category: 'Careless' | 'FormulaError' | 'ConceptConfused' | 'LogicGap' | 'KnowledgeBlind' | 'TimePressure';
    detailedReason: string;
  };
  knowledgeMap: {
    primaryPoint: string;
    relatedPoints: string[];
  };
  logicEngine: {
    mermaidCode: string;
    excalidrawJson?: string;
    difficulty: number;
    examinerIntent: string;
  };
  masteryLevel: string;
  variationQuestion?: string;
}

function sanitizeMermaid(code: string | undefined): string {
  if (!code) return '';
  let cleaned = code.trim();
  // 去掉可能出现的 ```mermaid ``` 代码块包裹
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/```mermaid/i, '')
      .replace(/```/g, '')
      .trim();
  }
  return cleaned;
}

export async function analyzeQuestionImage(base64Image: string, subject: string, userHint?: string): Promise<AIAnalysisResult[]> {
  const model = "gemini-3-flash-preview";
  const targetNumbers = userHint ? userHint.match(/\d+/g)?.map(n => parseInt(n, 10)).filter(n => !Number.isNaN(n)) : undefined;

  const prompt = `你是一个资深的${subject}专家。请深度分析这张错题图片，并输出结构严谨的 JSON 数据。

${userHint ? `用户补充提示：${userHint}
如果提示中出现了多道题（例如"第40和41题错了"），你必须分别分析每一道错题，并为每一道错题输出一条独立的记录。` : ''}

${targetNumbers && targetNumbers.length > 0 ? `本次只需要分析题目前的编号为：${targetNumbers.join('、')} 的这些题。
如果图片中还有其他编号的题目（例如 40 题），但不在上述编号列表中，则不要为这些题生成记录。
对于你返回的每一条记录，请在 title 字段中显式包含对应的题号，例如："第${targetNumbers[0]}题：……"。` : ''}

分析要求：
1. 识别题目内容与学生作答（如果有多道题，需逐题识别）。
2. 深度解读出题人意图：拆解题目设计逻辑，说明如何隐含求解条件或通过多步推理设置障碍。
3. 错误根源分析：必须从以下类别中选择最贴切的一个：Careless (粗心), FormulaError (公式记错), ConceptConfused (概念混淆), LogicGap (逻辑断层), KnowledgeBlind (知识盲区), TimePressure (时间压力)。
4. 知识图谱：识别核心知识点 (primaryPoint) 和关联知识点 (relatedPoints)。
5. 题目标题 title：请用极短的一句话概括这道错题的本质类型（例如："一般现在时被动语态填空"、"介词短语 in the old days 用法"），禁止直接复制整题内容。
5. 逻辑解题路径 (强制)：
   - 必须输出 mermaid.js 代码。该图表必须完整、逐步地展示解题的逻辑路径。
   - 如果是逻辑推导或证明，使用 flowchart TD，每个节点代表一个解题步骤。
   - 如果是知识关联，使用 mindmap。
   - 确保图表逻辑清晰，能够替代传统的纯文本步骤描述。
6. 创意草图 (可选)：如果是几何题，输出 Excalidraw JSON。
7. 答案对比：清晰提取学生答案与标准答案，并分析差异。
8. 同类变式：为每一道错题生成一到两道变式练习题（含答案）。

请严格按照提供的 JSON 架构返回数据，返回一个 JSON 数组，每个元素对应一道错题。`;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image.split(',')[1],
          },
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            questionText: { type: Type.STRING },
            comparison: {
              type: Type.OBJECT,
              properties: {
                studentAnswer: { type: Type.STRING },
                standardAnswer: { type: Type.STRING },
                gapAnalysis: { type: Type.STRING }
              },
              required: ["studentAnswer", "standardAnswer", "gapAnalysis"]
            },
            isCorrect: { type: Type.BOOLEAN },
            solution: { type: Type.STRING },
            errorRoot: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING, description: "Careless, FormulaError, ConceptConfused, LogicGap, KnowledgeBlind, TimePressure" },
                detailedReason: { type: Type.STRING }
              },
              required: ["category", "detailedReason"]
            },
            knowledgeMap: {
              type: Type.OBJECT,
              properties: {
                primaryPoint: { type: Type.STRING },
                relatedPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["primaryPoint", "relatedPoints"]
            },
            logicEngine: {
              type: Type.OBJECT,
              properties: {
                mermaidCode: { type: Type.STRING },
                excalidrawJson: { type: Type.STRING },
                difficulty: { type: Type.INTEGER },
                examinerIntent: { type: Type.STRING }
              },
              required: ["mermaidCode", "difficulty", "examinerIntent"]
            },
            masteryLevel: { type: Type.STRING },
            variationQuestion: { type: Type.STRING },
          },
          required: ["title", "tags", "questionText", "comparison", "isCorrect", "solution", "errorRoot", "knowledgeMap", "logicEngine", "masteryLevel"],
        },
      },
    },
  });

  const parsed = JSON.parse(response.text || '[]');
  // 兼容模型偶尔返回单个对象而不是数组的情况
  const analyses: AIAnalysisResult[] = Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === 'object' ? [parsed] : []);

  // 清洗 mermaid 代码，避免因为包裹在代码块中导致渲染失败
  return analyses.map((item) => ({
    ...item,
    logicEngine: {
      ...item.logicEngine,
      mermaidCode: sanitizeMermaid(item.logicEngine?.mermaidCode),
    },
  }));
}
