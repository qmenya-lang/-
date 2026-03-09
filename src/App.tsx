import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, Utensils, Sparkles, Clock, Info, ChevronRight, X, 
  Loader2, Home, User, Settings, Camera, Check, Trash, ChevronLeft,
  Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface UserProfile {
  nickname: string;
  age: number;
  height: number;
  weight: number;
  goals: string[];
  conditions: string[];
  avatar?: string;
}

interface Ingredient {
  id: string;
  name: string;
  image?: string;
}

interface Recipe {
  name: string;
  description: string;
  ingredientsUsed: string[];
  additionalIngredientsNeeded: string[];
  instructions: string[];
  healthBenefit: string;
}

type Tab = 'recommend' | 'pantry' | 'profile';

const DIETARY_GOALS = ['抗炎饮食', '减肥瘦身', '增肌', '低碳水', '地中海饮食', '生酮饮食'];
const HEALTH_CONDITIONS = ['糖尿病', '高血压', '高血脂', '尿酸高', '乳糖不耐受', '麸质过敏'];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('recommend');
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('user_profile');
    return saved ? JSON.parse(saved) : {
      nickname: '小助手',
      age: 25,
      height: 170,
      weight: 65,
      goals: ['抗炎饮食'],
      conditions: []
    };
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    const saved = localStorage.getItem('pantry_ingredients_v2');
    if (saved) return JSON.parse(saved);
    const initial = ['豆腐', '金针菇', '西兰花', '三文鱼', '姜', '蒜'];
    return initial.map(name => ({ id: Math.random().toString(36).substr(2, 9), name }));
  });

  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recipe[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>(() => {
    const hour = new Date().getHours();
    if (hour < 11) return '早餐';
    if (hour < 14) return '午餐';
    if (hour < 17) return '下午茶';
    if (hour < 21) return '晚餐';
    return '夜宵';
  });

  // Management state
  const [isManaging, setIsManaging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem('user_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('pantry_ingredients_v2', JSON.stringify(ingredients));
  }, [ingredients]);

  const addIngredient = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim()) {
      const newIng: Ingredient = {
        id: Math.random().toString(36).substr(2, 9),
        name: inputValue.trim(),
      };
      setIngredients([newIng, ...ingredients]);
      setInputValue('');
    }
  };

  const removeIngredient = (id: string) => {
    setIngredients(ingredients.filter(ing => ing.id !== id));
  };

  const bulkDelete = () => {
    setIngredients(ingredients.filter(ing => !selectedIds.has(ing.id)));
    setSelectedIds(new Set());
    setIsManaging(false);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 11) return '早餐';
    if (hour < 14) return '午餐';
    if (hour < 17) return '下午茶';
    if (hour < 21) return '晚餐';
    return '夜宵';
  };

  const getRecommendations = async () => {
    if (ingredients.length === 0) {
      setError('请先在“食材库”中添加一些食材');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const timeOfDay = selectedTime;
      const ingredientNames = ingredients.map(i => i.name).join(', ');
      
      const prompt = `
        用户画像：
        - 年龄：${profile.age}岁
        - 身高：${profile.height}cm
        - 体重：${profile.weight}kg
        - 饮食目标：${profile.goals.join(', ') || '无特定目标'}
        - 健康状况：${profile.conditions.join(', ') || '无特定状况'}
        
        现有食材：${ingredientNames}
        用餐时段：${timeOfDay}
        
        请根据以上信息推荐3个最适合该用户的菜谱。
        要求：
        1. 严格遵守用户的健康状况限制（如糖尿病需低GI，高血压需低盐）。
        2. 结合用户的饮食目标。
        3. 优先使用现有食材。
        4. 如果时段是“早餐”，可以推荐一些简单的简餐，如酸奶燕麦碗、全麦吐司等。
        
        请以JSON格式返回，包含一个recipes数组，每个对象包含：
        - name: 菜名
        - description: 简单描述
        - ingredientsUsed: 使用了哪些已有的食材
        - additionalIngredientsNeeded: 还需要哪些常见的辅助食材
        - instructions: 制作步骤数组
        - healthBenefit: 为什么这道菜适合该用户的特定需求（结合年龄、目标和状况说明）
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recipes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    ingredientsUsed: { type: Type.ARRAY, items: { type: Type.STRING } },
                    additionalIngredientsNeeded: { type: Type.ARRAY, items: { type: Type.STRING } },
                    instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    healthBenefit: { type: Type.STRING },
                  },
                  required: ["name", "description", "ingredientsUsed", "additionalIngredientsNeeded", "instructions", "healthBenefit"]
                }
              }
            },
            required: ["recipes"]
          }
        }
      });

      const data = JSON.parse(response.text || '{"recipes": []}');
      setRecommendations(data.recipes);
    } catch (err) {
      console.error(err);
      setError('获取推荐失败，请稍后再试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-slate-50 shadow-xl flex flex-col relative overflow-hidden font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-5 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {activeTab === 'recommend' ? `${profile.nickname}吃什么` : activeTab === 'pantry' ? '我的食材库' : '我的'}
            </h1>
            <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mt-0.5">
              {activeTab === 'recommend' ? '不要再问我吃什么啦！' : activeTab === 'pantry' ? 'Pantry Management' : 'User Profile'}
            </p>
          </div>
          
          {activeTab === 'pantry' && (
            <button 
              onClick={() => {
                setIsManaging(!isManaging);
                setSelectedIds(new Set());
              }}
              className={cn(
                "text-xs font-bold px-3 py-1.5 rounded-lg transition-all",
                isManaging ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"
              )}
            >
              {isManaging ? '完成' : '管理'}
            </button>
          )}
          
          {activeTab !== 'pantry' && (
            <div className="bg-emerald-100 p-2 rounded-xl">
              {activeTab === 'recommend' ? (
                <div className="relative flex items-center justify-center">
                  <Brain className="w-5 h-5 text-emerald-600" />
                  <Utensils className="w-2.5 h-2.5 text-emerald-700 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80" />
                </div>
              ) : (
                <User className="w-5 h-5 text-emerald-600" />
              )}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'recommend' && (
            <motion.div
              key="recommend"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              {/* User Summary Card */}
              <div className="bg-emerald-600 rounded-3xl p-5 text-white shadow-lg shadow-emerald-100 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm overflow-hidden border-2 border-white/30">
                      {profile.avatar ? (
                        <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] opacity-80 font-bold uppercase tracking-wider">当前状态</p>
                      <p className="text-sm font-bold">{profile.age}岁 · {profile.height}cm · {profile.weight}kg</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.goals.map(g => (
                      <span key={g} className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm font-medium">{g}</span>
                    ))}
                    {profile.conditions.map(c => (
                      <span key={c} className="text-[9px] bg-red-400/40 px-2 py-0.5 rounded-full backdrop-blur-sm font-medium">{c}</span>
                    ))}
                  </div>
                </div>
                <div className="absolute -right-6 -bottom-6 opacity-10">
                  <Utensils className="w-32 h-32" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-emerald-500" />
                    {selectedTime}推荐
                  </h2>
                </div>
                
                {/* Time Selection */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {['早餐', '午餐', '下午茶', '晚餐', '夜宵'].filter(t => t !== selectedTime).map(time => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border bg-white text-slate-500 border-slate-100 hover:border-emerald-200 active:scale-95"
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              {recommendations.length > 0 ? (
                <div className="space-y-4">
                  {recommendations.map((recipe, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3"
                    >
                      <h3 className="font-bold text-slate-900 text-lg">{recipe.name}</h3>
                      <p className="text-slate-500 text-xs leading-relaxed">{recipe.description}</p>
                      
                      <div className="pt-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">使用食材</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {recipe.ingredientsUsed.map((ing, i) => (
                            <span key={i} className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100 font-medium">
                              {ing}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">营养建议</h4>
                        <div className="bg-slate-50 p-3 rounded-xl text-[11px] text-slate-600 border-l-4 border-emerald-400 leading-relaxed">
                          {recipe.healthBenefit}
                        </div>
                      </div>

                      <details className="group pt-2">
                        <summary className="text-xs font-bold text-emerald-600 cursor-pointer flex items-center gap-1 list-none">
                          制作步骤
                          <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                        </summary>
                        <div className="mt-3 space-y-2 pl-2 border-l border-slate-100">
                          {recipe.instructions.map((step, i) => (
                            <div key={i} className="flex gap-3 text-xs text-slate-600">
                              <span className="text-emerald-400 font-bold">{i + 1}.</span>
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </motion.div>
                  ))}
                </div>
              ) : !loading && (
                <div className="bg-white rounded-3xl p-10 border border-dashed border-slate-200 text-center space-y-4">
                  <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                    <Sparkles className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="text-slate-400 text-xs px-4 leading-relaxed font-medium">
                    点击下方按钮，AI将根据您的身体状况和现有食材为您定制健康餐单。
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs border border-red-100 font-medium">
                  {error}
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={getRecommendations}
                  disabled={loading}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold text-white shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all active:scale-95",
                    loading ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-600"
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      正在定制餐单...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      整点吃的
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'pantry' && (
            <motion.div
              key="pantry"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col h-full"
            >
              {/* Add Input */}
              <div className="p-6 bg-white border-b border-slate-50">
                <form onSubmit={addIngredient} className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="输入食材名称..."
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
                  />
                  <button
                    type="submit"
                    className="bg-emerald-500 text-white p-3 rounded-xl hover:bg-emerald-600 active:scale-95 transition-all"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </form>
              </div>

              {/* Ingredient List */}
              <div className="flex-1 p-4 space-y-2">
                <AnimatePresence initial={false}>
                  {ingredients.map((ing) => (
                    <motion.div
                      key={ing.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="relative group"
                    >
                      {/* Swipe-like Delete Button (Hidden by default, revealed on hover or in manage mode) */}
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isManaging && (
                          <button 
                            onClick={() => removeIngredient(ing.id)}
                            className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div 
                        onClick={() => isManaging && toggleSelect(ing.id)}
                        className={cn(
                          "flex items-center gap-4 p-3 bg-white rounded-2xl border transition-all",
                          isManaging ? "cursor-pointer" : "cursor-default",
                          selectedIds.has(ing.id) ? "border-emerald-500 bg-emerald-50/30" : "border-slate-100",
                          !isManaging && "group-hover:border-emerald-200"
                        )}
                      >
                        {isManaging && (
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                            selectedIds.has(ing.id) ? "bg-emerald-500 border-emerald-500" : "border-slate-200"
                          )}>
                            {selectedIds.has(ing.id) && <Check className="w-3 h-3 text-white" />}
                          </div>
                        )}
                        
                        {/* Column 2: Image Placeholder */}
                        <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100 shrink-0">
                          {ing.image ? (
                            <img src={ing.image} alt={ing.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Camera className="w-5 h-5 text-slate-300" />
                          )}
                        </div>

                        {/* Column 1: Name */}
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-700">{ing.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">库存充足</p>
                        </div>

                        {!isManaging && (
                          <div className="text-slate-300 group-hover:translate-x-1 transition-transform">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {ingredients.length === 0 && (
                  <div className="py-20 text-center space-y-3">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                      <Utensils className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-400 text-xs font-medium">食材库是空的</p>
                  </div>
                )}
              </div>

              {/* Bulk Delete Footer */}
              <AnimatePresence>
                {isManaging && selectedIds.size > 0 && (
                  <motion.div
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    exit={{ y: 100 }}
                    className="fixed bottom-24 left-6 right-6 z-40"
                  >
                    <button
                      onClick={bulkDelete}
                      className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold shadow-xl shadow-red-100 flex items-center justify-center gap-2"
                    >
                      <Trash className="w-5 h-5" />
                      删除已选 ({selectedIds.size})
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-8"
            >
              {/* Avatar Section */}
              <section className="flex flex-col items-center space-y-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
                    {profile.avatar ? (
                      <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="w-10 h-10 text-slate-300" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 bg-emerald-500 text-white p-2 rounded-full shadow-lg cursor-pointer hover:bg-emerald-600 transition-colors">
                    <Camera className="w-4 h-4" />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setProfile({ ...profile, avatar: reader.result as string });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-slate-800">我的健康画像</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Personal Health Profile</p>
                </div>
              </section>

              {/* Basic Info */}
              <section className="space-y-4">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">基础信息</h2>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 ml-1">昵称</label>
                    <input 
                      type="text" 
                      value={profile.nickname}
                      onChange={e => setProfile({...profile, nickname: e.target.value})}
                      placeholder="输入您的昵称..."
                      className="w-full px-3 py-2.5 bg-white border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/10 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 ml-1">年龄</label>
                      <input 
                        type="number" 
                        value={profile.age}
                        onChange={e => setProfile({...profile, age: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2.5 bg-white border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/10 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 ml-1">身高(cm)</label>
                      <input 
                        type="number" 
                        value={profile.height}
                        onChange={e => setProfile({...profile, height: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2.5 bg-white border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/10 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 ml-1">体重(kg)</label>
                      <input 
                        type="number" 
                        value={profile.weight}
                        onChange={e => setProfile({...profile, weight: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2.5 bg-white border border-slate-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/10 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Dietary Goals */}
              <section className="space-y-4">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">饮食目标 (多选)</h2>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_GOALS.map(goal => (
                    <button
                      key={goal}
                      onClick={() => {
                        const next = profile.goals.includes(goal) 
                          ? profile.goals.filter(g => g !== goal)
                          : [...profile.goals, goal];
                        setProfile({...profile, goals: next});
                      }}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                        profile.goals.includes(goal)
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-100"
                          : "bg-white text-slate-500 border-slate-100 hover:border-emerald-200"
                      )}
                    >
                      {goal}
                    </button>
                  ))}
                </div>
              </section>

              {/* Health Conditions */}
              <section className="space-y-4">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">健康状况 (多选)</h2>
                <div className="flex flex-wrap gap-2">
                  {HEALTH_CONDITIONS.map(cond => (
                    <button
                      key={cond}
                      onClick={() => {
                        const next = profile.conditions.includes(cond) 
                          ? profile.conditions.filter(c => c !== cond)
                          : [...profile.conditions, cond];
                        setProfile({...profile, conditions: next});
                      }}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                        profile.conditions.includes(cond)
                          ? "bg-red-500 text-white border-red-500 shadow-md shadow-red-100"
                          : "bg-white text-slate-500 border-slate-100 hover:border-red-200"
                      )}
                    >
                      {cond}
                    </button>
                  ))}
                </div>
              </section>

              <div className="bg-slate-100 p-4 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  您的个人信息将仅用于优化AI菜谱推荐。我们建议您在开始任何新的饮食计划前咨询专业医生。
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 px-6 py-4 flex justify-around items-center z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <button
          onClick={() => setActiveTab('recommend')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'recommend' ? "text-emerald-600 scale-110" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <Home className="w-6 h-6" />
          <span className="text-[9px] font-bold uppercase tracking-widest">首页</span>
        </button>

        <button
          onClick={() => setActiveTab('pantry')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'pantry' ? "text-emerald-600 scale-110" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <Utensils className="w-6 h-6" />
          <span className="text-[9px] font-bold uppercase tracking-widest">食材库</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'profile' ? "text-emerald-600 scale-110" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <Settings className="w-6 h-6" />
          <span className="text-[9px] font-bold uppercase tracking-widest">我的</span>
        </button>
      </nav>
    </div>
  );
}
