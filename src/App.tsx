import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Plus, 
  ChevronLeft, 
  Camera, 
  Image as ImageIcon, 
  Trash2, 
  Download, 
  Upload, 
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Tag,
  Calendar,
  Share
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  WrongQuestion, 
  saveQuestion, 
  getQuestionsBySubject, 
  deleteQuestion, 
  getAllQuestions,
  importQuestions,
  clearAllQuestions
} from './services/db';
import { compressImage, fileToBase64 } from './services/image';
import { analyzeQuestionImage, AIAnalysisResult } from './services/ai';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Subject = 'English' | 'Math' | 'Physics' | 'Chinese';

const SUBJECTS: { id: Subject; name: string; color: string; icon: React.ReactNode }[] = [
  { id: 'Chinese', name: '语文', color: 'bg-red-500', icon: <BookOpen className="w-6 h-6" /> },
  { id: 'Math', name: '数学', color: 'bg-blue-500', icon: <div className="font-bold text-xl">∑</div> },
  { id: 'English', name: '英语', color: 'bg-indigo-500', icon: <div className="font-bold text-xl">A</div> },
  { id: 'Physics', name: '物理', color: 'bg-emerald-500', icon: <div className="font-bold text-xl">Φ</div> },
];

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'subject' | 'upload' | 'detail' | 'settings'>('home');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<WrongQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<WrongQuestion | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  useEffect(() => {
    if (currentView === 'subject' && selectedSubject) {
      loadQuestions(selectedSubject);
    }
  }, [currentView, selectedSubject]);

  const loadQuestions = async (subject: Subject) => {
    const data = await getQuestionsBySubject(subject);
    setQuestions(data.sort((a, b) => b.createdAt - a.createdAt));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSubject) return;

    try {
      setIsAnalyzing(true);
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64);
      
      const analysis = await analyzeQuestionImage(compressed, selectedSubject);
      
      const newQuestion: WrongQuestion = {
        subject: selectedSubject,
        title: analysis.title,
        tags: analysis.tags,
        image: compressed,
        analysis: analysis,
        createdAt: Date.now(),
      };

      await saveQuestion(newQuestion);
      await loadQuestions(selectedSubject);
      setCurrentView('subject');
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('分析失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('确定要删除这条记录吗？')) {
      await deleteQuestion(id);
      if (selectedSubject) loadQuestions(selectedSubject);
      setCurrentView('subject');
    }
  };

  const exportData = async () => {
    const all = await getAllQuestions();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `错题本备份_${new Date().toLocaleDateString()}.json`;
    a.click();
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        await importQuestions(data);
        alert('导入成功');
      } catch (err) {
        alert('导入失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
  };

  const filteredQuestions = questions.filter(q => 
    q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-[#1C1C1E] font-sans selection:bg-blue-100 pb-safe">
      {/* iOS Status Bar Background */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-[#F2F2F7]/80 backdrop-blur-md z-50 pointer-events-none" />

      <main className="pt-12 px-4 pb-24 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {currentView === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <header className="py-6">
                <h1 className="text-3xl font-bold tracking-tight">学霸错题本</h1>
                <p className="text-[#8E8E93] mt-1">记录每一次进步</p>
              </header>

              <div className="grid grid-cols-2 gap-4">
                {SUBJECTS.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => {
                      setSelectedSubject(sub.id);
                      setCurrentView('subject');
                    }}
                    className="aspect-square rounded-2xl bg-white p-6 shadow-sm flex flex-col items-center justify-center space-y-3 active:scale-95 transition-transform"
                  >
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg", sub.color)}>
                      {sub.icon}
                    </div>
                    <span className="font-semibold text-lg">{sub.name}</span>
                  </button>
                ))}
              </div>

              <div className="mt-8 space-y-4">
                <h2 className="text-xl font-bold px-1">工具</h2>
                <div className="bg-white rounded-2xl divide-y divide-gray-100 overflow-hidden shadow-sm">
                  <button onClick={() => setCurrentView('settings')} className="w-full px-6 py-4 flex items-center justify-between active:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Share className="w-4 h-4 text-gray-600" />
                      </div>
                      <span className="font-medium">备份与恢复</span>
                    </div>
                    <ChevronLeft className="w-5 h-5 text-gray-300 rotate-180" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'subject' && selectedSubject && (
            <motion.div 
              key="subject"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <header className="flex items-center justify-between sticky top-12 bg-[#F2F2F7]/80 backdrop-blur-md py-4 z-40">
                <button onClick={() => setCurrentView('home')} className="p-2 -ml-2 text-blue-500 flex items-center font-medium">
                  <ChevronLeft className="w-6 h-6" />
                  返回
                </button>
                <h1 className="text-xl font-bold">{SUBJECTS.find(s => s.id === selectedSubject)?.name}</h1>
                <div className="w-10" />
              </header>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="搜索题目或标签..."
                  className="w-full bg-white rounded-xl py-3 pl-10 pr-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                {filteredQuestions.length > 0 ? (
                  filteredQuestions.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => {
                        setSelectedQuestion(q);
                        setCurrentView('detail');
                      }}
                      className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-start space-x-4 active:scale-[0.98] transition-transform text-left"
                    >
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                        <img src={q.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 min-w-0 py-1">
                        <h3 className="font-bold text-lg truncate">{q.title}</h3>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {q.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">#{tag}</span>
                          ))}
                        </div>
                        <div className="flex items-center mt-2 text-[#8E8E93] text-xs">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(q.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="self-center">
                        {q.analysis.isCorrect ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-500" />
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="py-20 text-center text-gray-400">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>暂无错题记录</p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setIsActionSheetOpen(true)}
                className="fixed bottom-8 right-8 w-14 h-14 bg-blue-500 text-white rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-transform z-50"
              >
                <Plus className="w-8 h-8" />
              </button>
            </motion.div>
          )}

          {currentView === 'detail' && selectedQuestion && (
            <motion.div 
              key="detail"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <header className="flex items-center justify-between sticky top-12 bg-[#F2F2F7]/80 backdrop-blur-md py-4 z-40">
                <button onClick={() => setCurrentView('subject')} className="p-2 -ml-2 text-blue-500 flex items-center font-medium">
                  <ChevronLeft className="w-6 h-6" />
                  列表
                </button>
                <h1 className="text-xl font-bold truncate max-w-[200px]">{selectedQuestion.title}</h1>
                <button 
                  onClick={() => selectedQuestion.id && handleDelete(selectedQuestion.id)}
                  className="p-2 text-red-500"
                >
                  <Trash2 className="w-6 h-6" />
                </button>
              </header>

              <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
                <img src={selectedQuestion.image} alt="题目" className="w-full h-auto" referrerPolicy="no-referrer" />
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-6 shadow-sm space-y-6">
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold flex items-center">
                        <Tag className="w-5 h-5 mr-2 text-blue-500" />
                        分析结果
                      </h2>
                      <div className={cn(
                        "px-3 py-1 rounded-full text-sm font-bold flex items-center space-x-1",
                        selectedQuestion.analysis.isCorrect ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}>
                        {selectedQuestion.analysis.isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        <span>{selectedQuestion.analysis.isCorrect ? '作答正确' : '作答错误/未作答'}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">题目内容</h3>
                        <p className="text-gray-700 leading-relaxed">{selectedQuestion.analysis.questionText}</p>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">学生作答</h3>
                        <p className="text-gray-700 italic">{selectedQuestion.analysis.studentAnswer || '无'}</p>
                      </div>

                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2">解题思路</h3>
                        <p className="text-blue-900 leading-relaxed whitespace-pre-wrap">{selectedQuestion.analysis.solution}</p>
                      </div>

                      {!selectedQuestion.analysis.isCorrect && (
                        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                          <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-2">错误解析</h3>
                          <p className="text-red-900 leading-relaxed">{selectedQuestion.analysis.errorAnalysis}</p>
                        </div>
                      )}

                      <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">考察知识点</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedQuestion.analysis.knowledgePoints.map(kp => (
                            <span key={kp} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">{kp}</span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">出题意图</h3>
                        <p className="text-gray-700">{selectedQuestion.analysis.examinerIntent}</p>
                      </div>

                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                        <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-2">掌握程度建议</h3>
                        <p className="text-emerald-900">{selectedQuestion.analysis.masteryLevel}</p>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <header className="flex items-center justify-between sticky top-12 bg-[#F2F2F7]/80 backdrop-blur-md py-4 z-40">
                <button onClick={() => setCurrentView('home')} className="p-2 -ml-2 text-blue-500 flex items-center font-medium">
                  <ChevronLeft className="w-6 h-6" />
                  返回
                </button>
                <h1 className="text-xl font-bold">备份与恢复</h1>
                <div className="w-10" />
              </header>

              <div className="bg-white rounded-2xl divide-y divide-gray-100 overflow-hidden shadow-sm">
                <button onClick={exportData} className="w-full px-6 py-5 flex items-center space-x-4 active:bg-gray-50">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Download className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold">导出备份</div>
                    <div className="text-xs text-gray-400">将所有错题导出为 JSON 文件</div>
                  </div>
                </button>
                <label className="w-full px-6 py-5 flex items-center space-x-4 active:bg-gray-50 cursor-pointer">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold">导入备份</div>
                    <div className="text-xs text-gray-400">从 JSON 文件恢复错题数据</div>
                  </div>
                  <input type="file" accept=".json" onChange={importData} className="hidden" />
                </label>
                <button 
                  onClick={async () => {
                    if (confirm('确定要清空所有数据吗？此操作不可撤销。')) {
                      await clearAllQuestions();
                      alert('已清空');
                    }
                  }} 
                  className="w-full px-6 py-5 flex items-center space-x-4 active:bg-gray-50"
                >
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-red-600">清空所有数据</div>
                    <div className="text-xs text-gray-400">彻底删除所有学科的错题记录</div>
                  </div>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Hidden File Inputs */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment"
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
      />
      <input 
        type="file" 
        accept="image/*" 
        ref={galleryInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
      />

      {/* Action Sheet */}
      <AnimatePresence>
        {isActionSheetOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsActionSheetOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[110]"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 p-4 z-[120] pb-safe"
            >
              <div className="max-w-md mx-auto space-y-2">
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl overflow-hidden divide-y divide-gray-200">
                  <button 
                    onClick={() => {
                      setIsActionSheetOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full py-4 text-center text-blue-500 font-medium active:bg-gray-100 flex items-center justify-center space-x-2"
                  >
                    <Camera className="w-5 h-5" />
                    <span>拍照记录</span>
                  </button>
                  <button 
                    onClick={() => {
                      setIsActionSheetOpen(false);
                      galleryInputRef.current?.click();
                    }}
                    className="w-full py-4 text-center text-blue-500 font-medium active:bg-gray-100 flex items-center justify-center space-x-2"
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span>从相册选择</span>
                  </button>
                </div>
                <button 
                  onClick={() => setIsActionSheetOpen(false)}
                  className="w-full py-4 bg-white rounded-2xl text-center text-blue-500 font-bold active:bg-gray-100"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-8"
          >
            <div className="bg-white rounded-3xl p-8 max-w-xs w-full text-center space-y-4 shadow-2xl">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
              <h3 className="text-xl font-bold">AI 老师正在分析...</h3>
              <p className="text-gray-500 text-sm">我们正在识别题目、检查作答并生成深度解析，请稍候片刻。</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Tab Bar Fallback (Optional, but good for PWA feel) */}
      {currentView !== 'home' && (
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md border-t border-gray-100 flex items-center justify-around px-6 pb-safe z-40">
          <button onClick={() => setCurrentView('home')} className={cn("flex flex-col items-center space-y-1", currentView === 'home' ? "text-blue-500" : "text-gray-400")}>
            <BookOpen className="w-6 h-6" />
            <span className="text-[10px] font-medium">首页</span>
          </button>
          <button onClick={() => setIsActionSheetOpen(true)} className="flex flex-col items-center -mt-8">
            <div className="w-14 h-14 bg-blue-500 rounded-full shadow-lg flex items-center justify-center text-white">
              <Camera className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-medium mt-1 text-blue-500">记录错题</span>
          </button>
          <button onClick={() => setCurrentView('settings')} className={cn("flex flex-col items-center space-y-1", currentView === 'settings' ? "text-blue-500" : "text-gray-400")}>
            <Share className="w-6 h-6" />
            <span className="text-[10px] font-medium">备份</span>
          </button>
        </div>
      )}
    </div>
  );
}
