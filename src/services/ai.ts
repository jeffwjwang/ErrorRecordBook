import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface AIAnalysisResult {
  title: string;
  tags: string[];
  questionText: string;
  studentAnswer: string;
  isCorrect: boolean;
  solution: string;
  errorAnalysis: string;
  knowledgePoints: string[];
  examinerIntent: string;
  masteryLevel: string;
}

export async function analyzeQuestionImage(base64Image: string, subject: string): Promise<AIAnalysisResult> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `你是一个资深的${subject}老师。请分析这张包含学生作答的错题图片。
  1. 识别题目内容。
  2. 识别学生的作答（如果有）。
  3. 判断作答是否正确。
  4. 如果错误或未作答，提供：
     - 详细的解题思路和步骤。
     - 错误原因分析（哪些知识点没记牢）。
     - 出题者的意图（考察什么能力）。
     - 学生对该知识块的掌握程度建议。
  5. 为这道题起一个简洁的标题。
  6. 提供3-5个相关的标签。

  请严格按照JSON格式返回，不要包含任何Markdown代码块标记。`;

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
          studentAnswer: { type: Type.STRING },
          isCorrect: { type: Type.BOOLEAN },
          solution: { type: Type.STRING },
          errorAnalysis: { type: Type.STRING },
          knowledgePoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          examinerIntent: { type: Type.STRING },
          masteryLevel: { type: Type.STRING },
        },
        required: ["title", "tags", "questionText", "studentAnswer", "isCorrect", "solution", "errorAnalysis", "knowledgePoints", "examinerIntent", "masteryLevel"],
      },
    },
  });

  return JSON.parse(response.text || '{}');
}
