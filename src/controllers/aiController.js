const aiService = require('../services/aiService');
const aiQuotaService = require('../services/aiQuotaService');

const aiController = {
  async chat(req, res) {
    try {
      const userId = req.user.id;
      const { message, sessionId, projectId, lang, context } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'BadRequest', message: 'Noi dung tin nhan khong duoc de trong.' });
      }
      if (!projectId) {
        return res.status(400).json({ error: 'BadRequest', message: 'Vui long chon du an truoc khi su dung AI CoPilot.' });
      }
      const hasQuota = await aiQuotaService.checkQuota(userId);
      if (!hasQuota) {
        const quota = await aiQuotaService.getQuota(userId);
        return res.status(429).json({ error: 'QuotaExceeded', message: 'Ban da su dung het quota AI hom nay.', quota });
      }
      const result = await aiService.chat(userId, message.trim(), sessionId || null, projectId, lang || 'vi', context || {});
      await aiQuotaService.incrementUsage(userId);
      const quota = await aiQuotaService.getQuota(userId);
      return res.status(200).json({ message: result.aiMessage, sessionId: result.sessionId, quota });
    } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[AI Controller] chat error:', error.message);
    return res.status(500).json({ error: 'AIError', message: 'Da xay ra loi khi xu ly yeu cau AI. Vui long thu lai.' });
  }
  },

  async confirmAction(req, res) {
    try {
      const userId = req.user.id;
      const { actionId, sessionId } = req.body;
      if (!actionId || !sessionId) {
        return res.status(400).json({ error: 'BadRequest', message: 'Thieu actionId hoac sessionId.' });
      }
      const result = await aiService.executeAction(userId, actionId, sessionId);
      const quota = await aiQuotaService.getQuota(userId);
      return res.status(200).json({ success: true, message: result.message, data: result.data, quota });
    } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[AI Controller] confirmAction error:', error.message);
      if (error.message === 'Action not found or expired') {
        return res.status(404).json({ error: 'NotFound', message: 'Hanh dong khong tim thay hoac da het han.' });
      }
    return res.status(500).json({ error: 'AIError', message: 'Khong the thuc thi hanh dong. Vui long thu lai.' });
  }
  },

  async rejectAction(req, res) {
    try {
      return res.status(200).json({ success: true });
    } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }

    return res.status(500).json({ error: 'AIError', message: 'Loi he thong.' });
  }
  },

  async getQuota(req, res) {
    try {
      const quota = await aiQuotaService.getQuota(req.user.id);
      return res.status(200).json(quota);
    } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[AI Controller] getQuota error:', error.message);
    return res.status(500).json({ error: 'AIError', message: 'Khong the lay thong tin quota.' });
  }
  },

  async getSessions(req, res) {
    try {
      const sessions = await aiService.getSessions(req.user.id);
      return res.status(200).json({ sessions, total: sessions.length });
    } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[AI Controller] getSessions error:', error.message);
    return res.status(500).json({ error: 'AIError', message: 'Khong the lay danh sach phien tro chuyen.' });
  }
  },

  async getSession(req, res) {
    try {
      const session = await aiService.getSessionWithMessages(req.params.id, req.user.id);
      return res.status(200).json(session);
    } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: "AuthError", message: error.message });
    }
console.error('[AI Controller] getSession error:', error.message);
      return res.status(404).json({ error: 'NotFound', message: 'Phien tro chuyen khong tim thay.' });
    }
  },

  async deleteSession(req, res) {
    try {
      await aiService.deleteSession(req.params.id, req.user.id);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('[AI Controller] deleteSession error:', error.message);
    return res.status(500).json({ error: 'AIError', message: 'Khong the xoa phien tro chuyen.' });
  }
  }
};

module.exports = aiController;