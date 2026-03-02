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
  Share,
  Share2,
  Sparkles
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
import AIChat from './components/AIChat';
import MermaidRenderer from './components/MermaidRenderer';

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
  const [currentView, setCurrentView] = useState<'home' | 'subject' | 'upload' | 'detail' | 'settings' | 'ai-chat' | 'upload-preview'>('home');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<WrongQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<WrongQuestion | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [userHint, setUserHint] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [allQuestionsForAI, setAllQuestionsForAI] = useState<WrongQuestion[]>([]);

  useEffect(() => {
    if (currentView === 'subject' && selectedSubject) {
      loadQuestions(selectedSubject);
    }
    if (currentView === 'ai-chat') {
      loadAllQuestions();
    }
  }, [currentView, selectedSubject]);

  const loadAllQuestions = async () => {
    const data = await getAllQuestions();
    setAllQuestionsForAI(data);
  };

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
      setTempImage(compressed);
      setUserHint('');
      setCurrentView('upload-preview');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('上传失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startAnalysis = async () => {
    if (!tempImage || !selectedSubject) return;

    try {
      setIsAnalyzing(true);
      const analysis = await analyzeQuestionImage(tempImage, selectedSubject, userHint);
      
      const newQuestion: WrongQuestion = {
        subject: selectedSubject,
        title: analysis.title,
        tags: analysis.tags,
        image: tempImage,
        analysis: analysis,
        createdAt: Date.now(),
      };

      await saveQuestion(newQuestion);
      await loadQuestions(selectedSubject);
      setTempImage(null);
      setUserHint('');
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

  const handlePrint = () => {
    if (!selectedQuestion) return;
    setIsShareSheetOpen(false);
    
    // Generate a descriptive filename for the print dialog
    const subjectMap = {
      'Chinese': '语文',
      'Math': '数学',
      'English': '英语',
      'Physics': '物理'
    };
    const date = new Date(selectedQuestion.createdAt).toLocaleDateString('zh-CN').replace(/\//g, '-');
    const tagsStr = selectedQuestion.tags.length > 0 ? `_${selectedQuestion.tags.join(',')}` : '';
    const fileName = `[${subjectMap[selectedQuestion.subject]}]_${selectedQuestion.title}${tagsStr}_${date}`;
    
    const originalTitle = document.title;
    document.title = fileName;

    // iOS Safari in standalone mode (WebApp) sometimes has issues with window.print()
    // but it's the most reliable way to get a PDF via "Save as PDF" in the print dialog.
    setTimeout(() => {
      window.print();
      // Restore title after a delay to ensure print dialog picks it up
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    }, 500);
  };

  const handleShareImage = async () => {
    if (!detailRef.current || !selectedQuestion) return;
    
    try {
      setIsSharing(true);
      setIsShareSheetOpen(false);
      
      const subjectMap = {
        'Chinese': '语文',
        'Math': '数学',
        'English': '英语',
        'Physics': '物理'
      };
      const date = new Date(selectedQuestion.createdAt).toLocaleDateString('zh-CN').replace(/\//g, '-');
      const tagsStr = selectedQuestion.tags.length > 0 ? `_${selectedQuestion.tags.join(',')}` : '';
      const fileName = `[${subjectMap[selectedQuestion.subject]}]_${selectedQuestion.title}${tagsStr}_${date}`;
      
      // 等待 Mermaid 等异步渲染完成，避免截到半成品
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const element = detailRef.current;
      if (!element) {
        throw new Error('detail element not found');
      }

      // 优先使用 html2canvas 截图（对布局控制更细）
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(element, {
        backgroundColor: '#F2F2F7',
        // 移动端更保守一点，避免过大分辨率导致崩溃
        scale: window.devicePixelRatio > 2 ? 1.5 : 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: 430,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById('print-area');
          if (clonedElement) {
            clonedElement.style.width = '430px';
            clonedElement.style.height = 'auto';
            clonedElement.style.overflow = 'visible';
            clonedElement.style.borderRadius = '0';
            const images = clonedElement.getElementsByTagName('img');
            for (let i = 0; i < images.length; i++) {
              images[i].style.display = 'block';
            }
          }
        }
      });

      const downloadFromDataUrl = (dataUrl: string) => {
        const link = document.createElement('a');
        link.download = `${fileName}.png`;
        link.href = dataUrl;
        link.click();
      };

      const dataUrlFromCanvas = () => canvas.toDataURL('image/png');

      // 优先使用 Web Share API（如果可用）
      if (navigator.share && (navigator as any).canShare) {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            // 某些移动浏览器上 toBlob 可能返回 null，退回到直接下载
            const dataUrl = dataUrlFromCanvas();
            downloadFromDataUrl(dataUrl);
            return;
          }

          const file = new File([blob], `${fileName}.png`, { type: 'image/png' });
          
          if ((navigator as any).canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: fileName,
                text: '来自学霸错题本的分享',
              });
            } catch (shareError) {
              console.error('Share API failed:', shareError);
              const dataUrl = dataUrlFromCanvas();
              downloadFromDataUrl(dataUrl);
            }
          } else {
            const dataUrl = dataUrlFromCanvas();
            downloadFromDataUrl(dataUrl);
          }
        }, 'image/png');
      } else {
        const dataUrl = dataUrlFromCanvas();
        downloadFromDataUrl(dataUrl);
      }

    } catch (error) {
      console.error('Capture failed, trying fallback with dom-to-image-more:', error);
      // html2canvas 在部分移动端浏览器上不稳定，这里用 dom-to-image-more 兜底
      try {
        if (!detailRef.current || !selectedQuestion) throw error;
        const element = detailRef.current;
        const subjectMap = {
          'Chinese': '语文',
          'Math': '数学',
          'English': '英语',
          'Physics': '物理'
        };
        const date = new Date(selectedQuestion.createdAt).toLocaleDateString('zh-CN').replace(/\//g, '-');
        const tagsStr = selectedQuestion.tags.length > 0 ? `_${selectedQuestion.tags.join(',')}` : '';
        const fallbackFileName = `[${subjectMap[selectedQuestion.subject]}]_${selectedQuestion.title}${tagsStr}_${date}`;

        const domtoimage = (await import('dom-to-image-more')).default;
        const dataUrl = await domtoimage.toPng(element, {
          bgcolor: '#F2F2F7',
          quality: 1,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left',
          },
        });

        const link = document.createElement('a');
        link.download = `${fallbackFileName}.png`;
        link.href = dataUrl;
        link.click();
      } catch (fallbackError) {
        console.error('Fallback capture failed:', fallbackError);
        alert('生成分享图片失败，请尝试系统打印或截屏分享');
      }
    } finally {
      setIsSharing(false);
    }
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTag = !selectedTag || q.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  const allTags = Array.from(new Set(questions.flatMap(q => q.tags)));

  return (
    <div className="min-h-screen bg-[#F2F2F7] text-[#1C1C1E] font-sans selection:bg-blue-100 pb-safe">
      {/* AI Floating Button */}
      {currentView !== 'ai-chat' && (
        <button
          onClick={() => setCurrentView('ai-chat')}
          className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center z-50 active:scale-90 transition-transform"
        >
          <div className="relative">
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-blue-600 animate-pulse" />
            <span className="font-bold text-xs">AI</span>
          </div>
        </button>
      )}

      <main className="pt-12 px-4 pb-24 max-w-[430px] mx-auto">
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

          {currentView === 'ai-chat' && (
            <motion.div
              key="ai-chat"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-full"
            >
              <AIChat 
                onBack={() => setCurrentView('home')} 
                questions={allQuestionsForAI} 
              />
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

              {allTags.length > 0 && (
                <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                  <button
                    onClick={() => setSelectedTag(null)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                      !selectedTag ? "bg-blue-500 text-white" : "bg-white text-gray-600"
                    )}
                  >
                    全部
                  </button>
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center space-x-1",
                        selectedTag === tag ? "bg-blue-500 text-white" : "bg-white text-gray-600"
                      )}
                    >
                      <Tag className="w-3 h-3" />
                      <span>{tag}</span>
                    </button>
                  ))}
                </div>
              )}

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
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold">
                            {q.analysis.knowledgeMap?.primaryPoint || '未分类'}
                          </span>
                          {q.tags.slice(0, 1).map(tag => (
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

          {currentView === 'upload-preview' && tempImage && (
            <motion.div
              key="upload-preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <header className="flex items-center justify-between sticky top-12 bg-[#F2F2F7]/80 backdrop-blur-md py-4 z-40">
                <button onClick={() => {
                  setTempImage(null);
                  setCurrentView('subject');
                }} className="p-2 -ml-2 text-blue-500 flex items-center font-medium">
                  <ChevronLeft className="w-6 h-6" />
                  取消
                </button>
                <h1 className="text-xl font-bold">补充信息</h1>
                <div className="w-10" />
              </header>

              <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                <img src={tempImage} alt="预览" className="w-full h-auto max-h-[300px] object-contain bg-gray-50" referrerPolicy="no-referrer" />
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                  <div className="flex items-center space-x-2 text-blue-600">
                    <Sparkles className="w-5 h-5" />
                    <h2 className="font-bold">告诉 AI 哪道题错了？</h2>
                  </div>
                  <textarea
                    placeholder="例如：第29题错了，或者：这篇阅读理解的最后一题..."
                    className="w-full h-32 bg-gray-50 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                    value={userHint}
                    onChange={(e) => setUserHint(e.target.value)}
                  />
                  <p className="text-[10px] text-gray-400">补充提示能帮助 AI 更精准地定位题目，特别是当图片中包含多道题时。</p>
                </div>

                <button
                  onClick={startAnalysis}
                  disabled={isAnalyzing}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>正在深度分析...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>开始 AI 深度分析</span>
                    </>
                  )}
                </button>
              </div>
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
                <h1 className="text-xl font-display font-bold truncate max-w-[150px]">{selectedQuestion.title}</h1>
                <div className="flex items-center">
                  <button 
                    onClick={() => setIsShareSheetOpen(true)}
                    className="p-2 text-blue-500"
                    disabled={isSharing}
                  >
                    {isSharing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Share2 className="w-6 h-6" />}
                  </button>
                  <button 
                    onClick={() => selectedQuestion.id && handleDelete(selectedQuestion.id)}
                    className="p-2 text-red-500"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </div>
              </header>

              <div ref={detailRef} id="print-area" className="space-y-8 pb-12">
                {/* Bento Grid Header */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-4 bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                    <img src={selectedQuestion.image} alt="题目" className="w-full h-auto" referrerPolicy="no-referrer" />
                  </div>
                  
                  {/* Knowledge Points Block */}
                  <div className="col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2">
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">核心知识点</span>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold border border-blue-100">
                        {selectedQuestion.analysis.knowledgeMap?.primaryPoint || (selectedQuestion.analysis as any).knowledgePoints?.[0] || '未分类'}
                      </span>
                      {(selectedQuestion.analysis.knowledgeMap?.relatedPoints || (selectedQuestion.analysis as any).knowledgePoints?.slice(1) || []).map((kp: string) => (
                        <span key={kp} className="px-3 py-1 bg-gray-50 text-gray-500 rounded-lg text-sm border border-gray-100">
                          {kp}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* Comparison Block */}
                  <div className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col space-y-2">
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">我的答案</span>
                    <div className="text-red-500 font-bold text-sm break-words line-clamp-3">
                      {selectedQuestion.analysis.comparison?.studentAnswer || (selectedQuestion.analysis as any).studentAnswer || '无'}
                    </div>
                  </div>
                  
                  <div className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col space-y-2">
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">标准答案</span>
                    <div className="text-emerald-600 font-bold text-sm break-words line-clamp-3">
                      {selectedQuestion.analysis.comparison?.standardAnswer || '见解析'}
                    </div>
                  </div>

                  {/* Difficulty & Status */}
                  <div className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-center items-center space-y-1">
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">难度</span>
                    <div className="flex text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Sparkles key={i} className={cn("w-3 h-3", i < (selectedQuestion.analysis.logicEngine?.difficulty || (selectedQuestion.analysis as any).difficulty || 3) ? "fill-current" : "text-gray-200")} />
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-center space-x-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      selectedQuestion.analysis.isCorrect ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                    )}>
                      {selectedQuestion.analysis.isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    </div>
                    <span className="font-bold text-sm">{selectedQuestion.analysis.isCorrect ? '已掌握' : '待攻克'}</span>
                  </div>
                </div>

                {/* Main Content with Line Guidance */}
                <div className="space-y-8">
                  {/* Core Insight - Emerald Highlight */}
                  <div className="bg-emerald-500 rounded-3xl p-6 text-white shadow-lg shadow-emerald-500/20 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                    <h2 className="text-sm font-bold uppercase tracking-widest mb-3 opacity-80">核心洞察</h2>
                    <p className="text-xl font-display font-medium leading-relaxed italic">
                      “{selectedQuestion.analysis.comparison?.gapAnalysis || (selectedQuestion.analysis as any).knowledgePoints?.[0] || '深度解析中...'}”
                    </p>
                  </div>

                  {/* Step by Step Analysis - Line Guidance */}
                  <div className="space-y-6 line-guidance px-2">
                    <div className="relative pl-10">
                      <div className="absolute left-0 top-0 w-8 h-8 bg-white rounded-full border-2 border-blue-500 flex items-center justify-center z-10 shadow-sm">
                        <span className="text-xs font-bold text-blue-600">01</span>
                      </div>
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">题目还原</h3>
                      <p className="text-gray-700 leading-relaxed font-serif">{selectedQuestion.analysis.questionText}</p>
                    </div>

                    <div className="relative pl-10">
                      <div className="absolute left-0 top-0 w-8 h-8 bg-white rounded-full border-2 border-blue-500 flex items-center justify-center z-10 shadow-sm">
                        <span className="text-xs font-bold text-blue-600">02</span>
                      </div>
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">出题人意图</h3>
                      <p className="text-gray-700 leading-relaxed">{selectedQuestion.analysis.logicEngine?.examinerIntent || (selectedQuestion.analysis as any).examinerIntent}</p>
                    </div>

                    <div className="relative pl-10">
                      <div className="absolute left-0 top-0 w-8 h-8 bg-white rounded-full border-2 border-blue-500 flex items-center justify-center z-10 shadow-sm">
                        <span className="text-xs font-bold text-blue-600">03</span>
                      </div>
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">解题路径 (逻辑推演)</h3>
                      <div className="space-y-4">
                        <MermaidRenderer chart={selectedQuestion.analysis.logicEngine?.mermaidCode || (selectedQuestion.analysis as any).mermaidCode || ''} />
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                          <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm">{selectedQuestion.analysis.solution}</p>
                        </div>
                      </div>
                    </div>

                    {/* Error Root - Violet Highlight */}
                    <div className="relative pl-10">
                      <div className="absolute left-0 top-0 w-8 h-8 bg-violet-500 rounded-full flex items-center justify-center z-10 shadow-lg shadow-violet-500/30">
                        <XCircle className="w-5 h-5 text-white" />
                      </div>
                      <div className="bg-violet-500 rounded-2xl p-5 text-white shadow-xl shadow-violet-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-bold uppercase tracking-widest opacity-80">错误根源剖析</h3>
                          <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold">
                            {selectedQuestion.analysis.errorRoot?.category || '未分类'}
                          </span>
                        </div>
                        <p className="font-medium">{selectedQuestion.analysis.errorRoot?.detailedReason || (selectedQuestion.analysis as any).errorAnalysis}</p>
                      </div>
                    </div>

                    <div className="relative pl-10">
                      <div className="absolute left-0 top-0 w-8 h-8 bg-white rounded-full border-2 border-emerald-500 flex items-center justify-center z-10 shadow-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">掌握建议</h3>
                      <p className="text-emerald-700 font-medium">{selectedQuestion.analysis.masteryLevel}</p>
                    </div>
                  </div>

                  {/* Variation Test */}
                  {selectedQuestion.analysis.variationQuestion && (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                      <div className="flex items-center space-x-2 text-blue-600">
                        <Sparkles className="w-5 h-5" />
                        <h2 className="font-bold">同类变式练习</h2>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-2xl text-gray-700 font-serif leading-relaxed">
                        {selectedQuestion.analysis.variationQuestion}
                      </div>
                      <p className="text-[10px] text-center text-gray-300 italic">尝试独立完成这道题，验证你的掌握程度</p>
                    </div>
                  )}
                </div>

                {/* Footer Branding */}
                <div className="text-center pt-8">
                  <div className="font-display text-2xl font-black text-gray-200 tracking-tighter">ERROR RECORD BOOK</div>
                  <div className="text-[10px] text-gray-300 uppercase tracking-[0.3em] mt-1">AI Powered Learning Assistant</div>
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

      {/* Share Options Sheet */}
      <AnimatePresence>
        {isShareSheetOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShareSheetOpen(false)}
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
                    onClick={handleShareImage}
                    className="w-full py-4 text-center text-blue-500 font-medium active:bg-gray-100 flex items-center justify-center space-x-2"
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span>分享为长图片 (推荐)</span>
                  </button>
                  <button 
                    onClick={handlePrint}
                    className="w-full py-4 text-center text-blue-500 font-medium active:bg-gray-100 flex items-center justify-center space-x-2"
                  >
                    <Share className="w-5 h-5" />
                    <span>打印 / 另存为 PDF</span>
                  </button>
                </div>
                <button 
                  onClick={() => setIsShareSheetOpen(false)}
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
          <button onClick={() => setCurrentView('home')} className="flex flex-col items-center space-y-1 text-gray-400">
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
