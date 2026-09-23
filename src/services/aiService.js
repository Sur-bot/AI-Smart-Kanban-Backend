const { GoogleGenerativeAI } = require('@google/generative-ai');
const supabase = require('../config/supabase');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODELS = { fast: 'gemini-2.0-flash', pro: 'gemini-1.5-pro' };

const AI_FUNCTION_DECLARATIONS = [
  {
    name: 'createTask',
    description: 'Tao tac vu moi trong du an hien tai.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Tieu de cua tac vu' },
        description: { type: 'string', description: 'Mo ta chi tiet' },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low', 'none'] },
        taskType: { type: 'string', enum: ['task', 'bug', 'story', 'feature', 'epic', 'milestone'] },
        dueDate: { type: 'string', description: 'Ngay han chot (ISO 8601)' },
        assigneeId: { type: 'string', description: 'ID nguoi duoc phan cong' }
      },
      required: ['title']
    }
  },
  {
    name: 'updateTask',
    description: 'Cap nhat thong tin cua mot tac vu hien co.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'ID cua tac vu can cap nhat' },
        title: { type: 'string' },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low', 'none'] },
        dueDate: { type: 'string' },
        statusId: { type: 'string' },
        assigneeId: { type: 'string' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'deleteTask',
    description: 'Xoa mot tac vu. Chi su dung khi user yeu cau ro rang.',
    parameters: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'ID cua tac vu can xoa' } },
      required: ['taskId']
    }
  },
  {
    name: 'listTasks',
    description: 'Liet ke danh sach tac vu theo bo loc.',
    parameters: {
      type: 'object',
      properties: {
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low', 'none'] },
        isOverdue: { type: 'boolean' },
        assigneeId: { type: 'string' },
        statusCategory: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done', 'cancelled'] }
      }
    }
  },
  {
    name: 'analyzeProject',
    description: 'Phan tich tong quan du an: tien do, bottleneck, tasks qua han.',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'suggestPriority',
    description: 'Goi y muc uu tien phu hop cho tac vu.',
    parameters: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'] }
  },
  {
    name: 'suggestAssignee',
    description: 'Goi y nguoi phu trach phu hop cho tac vu.',
    parameters: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'] }
  }
];

function buildSystemPrompt(lang, context) {
  const langInstructions = {
    vi: 'Luon tra loi bang Tieng Viet. Su dung ngon ngu chuyen nghiep, ngan gon.',
    en: 'Always respond in English. Use professional, concise language.'
  };
  const langPrompt = langInstructions[lang] || langInstructions['vi'];
  let contextSection = '';
  if (context && context.projectInfo) {
    const p = context.projectInfo;
    contextSection += `\n\n## Thong tin du an hien tai:\n- Ten: ${p.name}\n- Tong so task: ${p.taskCount}\n- So thanh vien: ${p.memberCount}\n- Tasks qua han: ${p.overdueCount || 0}`;
  }
  if (context && context.currentTasks && context.currentTasks.length > 0) {
    contextSection += `\n\n## Danh sach tasks hien tai (${context.currentTasks.length} tasks):`;
    context.currentTasks.slice(0, 30).forEach((t, i) => {
      contextSection += `\n${i + 1}. [${t.id.substring(0, 8)}] "${t.title}" | Status: ${t.status} | Priority: ${t.priority}${t.assignee ? ` | Assignee: ${t.assignee}` : ''}${t.dueDate ? ` | Due: ${t.dueDate}` : ''}`;
    });
  }
  return `Ban la **AI CoPilot** — tro ly quan ly du an thong minh cho ung dung AI Smart Kanban.

## Vai tro:
- Ho tro quan ly tac vu (tasks), phan tich du an, va de xuat toi uu.
- Co kha nang tao, sua, xoa task thong qua Function Calling.
- Phan tich rui ro, goi y uu tien, va toi uu phan cong.

## Nguyen tac:
1. ${langPrompt}
2. Khi user yeu cau hanh dong thay doi du lieu, su dung Function Calling. KHONG tu tao du lieu gia.
3. Luon giai thich ro rang hanh dong se thuc hien truoc khi goi function.
4. Neu thieu thong tin, hoi lai user thay vi doan.
5. Khi phan tich du an, dua ra nhan xet co co so dua tren du lieu thuc te.
6. Khong bia ra thong tin khong co trong context.
7. Format cau tra loi voi markdown khi can thiet.
${contextSection}`;
}

const aiService = {
  async chat(userId, message, sessionId, projectId, lang, context) {
    lang = lang || 'vi';
    context = context || {};
    const session = sessionId
      ? await this.getSession(sessionId, userId)
      : await this.createSession(userId, projectId, message);
    await this.saveMessage(session.id, 'user', message);
    const chatHistory = await this.getChatHistory(session.id, 20);
    const systemPrompt = buildSystemPrompt(lang, context);
    const model = genAI.getGenerativeModel({
      model: MODELS.fast,
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: AI_FUNCTION_DECLARATIONS }]
    });
    const chat = model.startChat({
      history: chatHistory.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        parts: [{ text: m.content }]
      }))
    });
    const result = await chat.sendMessage(message);
    const response = result.response;
    let pendingActions = [];
    let aiContent = '';
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      pendingActions = functionCalls.map(fc => ({
        id: require('crypto').randomUUID(),
        functionName: fc.name,
        description: this.describeFunctionCall(fc.name, fc.args),
        parameters: fc.args,
        status: 'pending'
      }));
      try { aiContent = response.text(); } catch(e) { aiContent = ''; }
      if (!aiContent) aiContent = this.generateActionSummary(pendingActions, lang);
    } else {
      aiContent = response.text();
    }
    const metadata = pendingActions.length > 0 ? { pendingActions } : {};
    await this.saveMessage(session.id, 'assistant', aiContent, metadata);
    return {
      aiMessage: {
        id: require('crypto').randomUUID(),
        role: 'assistant',
        content: aiContent,
        status: 'done',
        timestamp: new Date().toISOString(),
        pendingActions: pendingActions.length > 0 ? pendingActions : undefined
      },
      sessionId: session.id,
      pendingActions
    };
  },

  async executeAction(userId, actionId, sessionId) {
    const { data: messages, error } = await supabase
      .from('ai_chat_messages')
      .select('metadata')
      .eq('session_id', sessionId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    let targetAction = null;
    for (const msg of messages) {
      const actions = (msg.metadata && msg.metadata.pendingActions) || [];
      const found = actions.find(a => a.id === actionId);
      if (found) { targetAction = found; break; }
    }
    if (!targetAction) throw new Error('Action not found or expired');
    const result = await this.executeFunctionCall(targetAction.functionName, targetAction.parameters, userId);
    const resultMessage = 'Da thuc hien: ' + targetAction.description;
    await this.saveMessage(sessionId, 'assistant', resultMessage, {
      executedAction: { ...targetAction, status: 'executed', result }
    });
    return { success: true, message: resultMessage, data: result };
  },

  async executeFunctionCall(functionName, params, userId) {
    const taskService = require('./taskService');
    switch (functionName) {
      case 'createTask': return await taskService.createTask({ ...params }, userId);
      case 'updateTask': return await taskService.updateTask(params.taskId, params, userId);
      case 'deleteTask': return await taskService.deleteTask(params.taskId, userId);
      case 'listTasks': return await taskService.getTasks(params, userId);
      default: return { type: 'analysis', message: 'Analysis completed' };
    }
  },

  describeFunctionCall(name, args) {
    const desc = {
      createTask: `Tao tac vu: "${args.title}"${args.priority ? ` (${args.priority})` : ''}${args.dueDate ? ` - Deadline: ${args.dueDate}` : ''}`,
      updateTask: `Cap nhat tac vu [${(args.taskId || '').substring(0, 8)}]`,
      deleteTask: `Xoa tac vu [${(args.taskId || '').substring(0, 8)}]`,
      listTasks: `Liet ke tac vu${args.isOverdue ? ' qua han' : ''}`,
      analyzeProject: 'Phan tich tong quan du an',
      suggestPriority: `Goi y uu tien cho tac vu [${(args.taskId || '').substring(0, 8)}]`,
      suggestAssignee: `Goi y phan cong cho tac vu [${(args.taskId || '').substring(0, 8)}]`
    };
    return desc[name] || `Thuc hien: ${name}`;
  },

  generateActionSummary(actions, lang) {
    if (lang === 'en') return `I propose the following action(s):\n${actions.map(a => '- ' + a.description).join('\n')}\n\nPlease confirm to proceed.`;
    return `Toi de xuat thuc hien hanh dong sau:\n${actions.map(a => '- ' + a.description).join('\n')}\n\nVui long xac nhan de tiep tuc.`;
  },

  async createSession(userId, projectId, firstMessage) {
    const title = firstMessage.length > 60 ? firstMessage.substring(0, 57) + '...' : firstMessage;
    const { data, error } = await supabase
      .from('ai_chat_sessions')
      .insert({ user_id: userId, project_id: projectId || null, title })
      .select().single();
    if (error) throw error;
    return data;
  },

  async getSession(sessionId, userId) {
    const { data, error } = await supabase
      .from('ai_chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async getSessions(userId) {
    const { data, error } = await supabase
      .from('ai_chat_sessions')
      .select('id, user_id, project_id, title, message_count, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  },

  async getSessionWithMessages(sessionId, userId) {
    const session = await this.getSession(sessionId, userId);
    const { data: messages, error } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return {
      ...session,
      messages: (messages || []).map(m => ({
        id: m.id, role: m.role, content: m.content, status: 'done',
        timestamp: m.created_at,
        pendingActions: (m.metadata && m.metadata.pendingActions) || undefined
      }))
    };
  },

  async deleteSession(sessionId, userId) {
    const { error } = await supabase
      .from('ai_chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);
    if (error) throw error;
    return { success: true };
  },

  async saveMessage(sessionId, role, content, metadata) {
    metadata = metadata || {};
    const { data, error } = await supabase
      .from('ai_chat_messages')
      .insert({ session_id: sessionId, role, content, metadata })
      .select().single();
    if (error) throw error;
    return data;
  },

  async getChatHistory(sessionId, limit) {
    limit = limit || 20;
    const { data, error } = await supabase
      .from('ai_chat_messages')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }
};

module.exports = aiService;
