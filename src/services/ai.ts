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

export async function analyzeQuestionImage(base64Image: string, subject: string): Promise<AIAnalysisResult> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `你是一个资深的${subject}专家。请深度分析这张错题图片，并输出结构严谨的 JSON 数据。

分析要求：
1. 识别题目内容与学生作答。
2. 深度解读出题人意图：拆解题目设计逻辑，说明如何隐含求解条件或通过多步推理设置障碍。
3. 错误根源分析：必须从以下类别中选择最贴切的一个：Careless (粗心), FormulaError (公式记错), ConceptConfused (概念混淆), LogicGap (逻辑断层), KnowledgeBlind (知识盲区), TimePressure (时间压力)。
4. 知识图谱：识别核心知识点 (primaryPoint) 和关联知识点 (relatedPoints)。
5. 逻辑可视化 (强制)：
   - 必须输出 mermaid.js 代码。如果是逻辑推导或证明，使用 flowchart TD；如果是知识关联，使用 mindmap。
6. 创意草图 (可选)：如果是几何题，输出 Excalidraw JSON。
7. 答案对比：清晰提取学生答案与标准答案，并分析差异。
8. 同类变式：生成一道练习题（含答案）。

请严格按照提供的 JSON 架构返回数据。`;

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
  });

  return JSON.parse(response.text || '{}');
}
