import { openDB, IDBPDatabase } from 'idb';

export interface WrongQuestion {
  id?: number;
  subject: 'English' | 'Math' | 'Physics' | 'Chinese';
  title: string;
  tags: string[];
  image: string; // Base64 compressed image
  analysis: {
    questionText: string;
    studentAnswer: string;
    isCorrect: boolean;
    solution: string;
    errorAnalysis: string;
    knowledgePoints: string[];
    examinerIntent: string;
    masteryLevel: string;
  };
  createdAt: number;
}

const DB_NAME = 'WrongQuestionDB';
const STORE_NAME = 'questions';

export async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('subject', 'subject');
        store.createIndex('createdAt', 'createdAt');
      }
    },
  });
}

export async function saveQuestion(question: WrongQuestion) {
  const db = await initDB();
  return db.add(STORE_NAME, question);
}

export async function getAllQuestions(): Promise<WrongQuestion[]> {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

export async function getQuestionsBySubject(subject: string): Promise<WrongQuestion[]> {
  const db = await initDB();
  const index = db.transaction(STORE_NAME).store.index('subject');
  return index.getAll(subject);
}

export async function deleteQuestion(id: number) {
  const db = await initDB();
  return db.delete(STORE_NAME, id);
}

export async function clearAllQuestions() {
  const db = await initDB();
  return db.clear(STORE_NAME);
}

export async function importQuestions(questions: WrongQuestion[]) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  for (const q of questions) {
    const { id, ...rest } = q; // Remove ID to let it auto-increment or keep it if you want exact replica
    await tx.store.put(rest);
  }
  await tx.done;
}
