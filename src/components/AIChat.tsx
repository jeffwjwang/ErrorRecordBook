import React, { useState, useEffect, useRef } from 'react';
import { Send, ChevronLeft, Bot, User, Loader2, Sparkles, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from "@google/genai";
import { WrongQuestion } from '../services/db';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatProps {
  onBack: () => void;
  questions: WrongQuestion[];
}

export default function AIChat({ onBack, questions }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '你好！我是你的学霸 AI 助手。我可以帮你分析错题、总结知识点，或者针对你的薄弱环节出题测试。你想聊聊哪方面？' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Prepare context from questions
      const context = questions.map(q => ({
        subject: q.subject,
        title: q.title,
        tags: q.tags,
        knowledgePoints: q.analysis.knowledgePoints,
        errorAnalysis: q.analysis.errorAnalysis,
        masteryLevel: q.analysis.masteryLevel,
        date: new Date(q.createdAt).toLocaleDateString()
      }));

      const systemInstruction = `
        你是一个专业的 AI 学习助手，专门帮助学生管理和分析错题本。
        你有权访问用户的错题数据：${JSON.stringify(context)}
        
        你的任务包括：
        1. 帮助用户查找特定的错题。
        2. 针对多个错题进行总结，分析用户的知识漏洞。
        3. 针对用户掌握不佳的知识点，出一些练习题进行测试。
        4. 提供学习建议。
        
        请使用亲切、鼓励的语气。回答请使用 Markdown 格式。
        如果用户问的问题与错题本无关，请礼貌地引导回学习话题。
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messages.concat({ role: 'user', content: userMessage }).map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        })),
        config: {
          systemInstruction,
        }
      });

      const aiResponse = response.text || '抱歉，我没能理解你的意思。';
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      console.error('AI Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，我现在遇到了一点技术问题，请稍后再试。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-white rounded-3xl overflow-hidden shadow-xl border border-gray-100">
      {/* Header */}
      <header className="px-6 py-4 bg-blue-600 text-white flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="p-1 -ml-2 hover:bg-white/10 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center space-x-2">
            <Bot className="w-6 h-6" />
            <h1 className="font-bold text-lg">AI 助手</h1>
          </div>
        </div>
        <div className="flex items-center space-x-1 bg-white/20 px-3 py-1 rounded-full text-xs">
          <Sparkles className="w-3 h-3" />
          <span>Gemini Powered</span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex w-full",
              m.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            <div className={cn(
              "flex max-w-[85%] space-x-3",
              m.role === 'user' ? "flex-row-reverse space-x-reverse" : "flex-row"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm",
                m.role === 'user' ? "bg-blue-100 text-blue-600" : "bg-white text-blue-600 border border-blue-100"
              )}>
                {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={cn(
                "px-4 py-3 rounded-2xl shadow-sm",
                m.role === 'user' 
                  ? "bg-blue-600 text-white rounded-tr-none" 
                  : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
              )}>
                <div className="prose prose-sm max-w-none prose-p:leading-relaxed">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-100">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm text-gray-500">AI 正在思考中...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-100">
        <div className="flex items-center space-x-2 bg-gray-100 rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <input
            type="text"
            placeholder="问问 Gemini..."
            className="flex-1 bg-transparent border-none focus:outline-none text-sm py-2"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              "p-2 rounded-xl transition-colors",
              input.trim() && !isLoading ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
