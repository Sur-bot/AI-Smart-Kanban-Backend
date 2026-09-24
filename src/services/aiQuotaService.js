const supabase = require('../config/supabase');

/**
 * Service quản lý AI Usage Quota.
 * Free plan: 50 câu/ngày | Pro: 500 | Enterprise: unlimited
 */
const aiQuotaService = {
  async getQuota(userId) {
    await this.autoResetIfNeeded(userId);
    const { data, error } = await supabase
      .from('ai_usage_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      const { data: newQuota, error: insertError } = await supabase
        .from('ai_usage_quotas')
        .insert({
          user_id: userId,
          daily_used: 0,
          daily_limit: 50,
          plan_type: 'free',
          last_reset_at: new Date().toISOString()
        })
        .select()
        .single();
      if (insertError) { console.error('DB Quota error on insert:', insertError.message); const err = new Error('D?ch v? t?m th?i kh�ng kh? d?ng'); err.statusCode = 503; throw err; }
      return this.formatQuota(newQuota);
    }
    if (error) { console.error('DB Quota error on select:', error.message); const err = new Error('D?ch v? t?m th?i kh�ng kh? d?ng'); err.statusCode = 503; throw err; }
    return this.formatQuota(data);
  },

  async checkQuota(userId) {
    const quota = await this.getQuota(userId);
    if (quota.planType === 'enterprise') return true;
    return quota.used < quota.limit;
  },

  async incrementUsage(userId) {
    const quota = await this.getQuota(userId);
    const { error } = await supabase
      .from('ai_usage_quotas')
      .update({ daily_used: quota.used + 1 })
      .eq('user_id', userId);
    if (error) console.error('[aiQuotaService] incrementUsage error:', error);
  },

  async autoResetIfNeeded(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await supabase
      .from('ai_usage_quotas')
      .update({ daily_used: 0, last_reset_at: new Date().toISOString() })
      .eq('user_id', userId)
      .lt('last_reset_at', today.toISOString())
      .gt('daily_used', 0);
  },

  formatQuota(data) {
    const resetAt = new Date();
    resetAt.setDate(resetAt.getDate() + 1);
    resetAt.setHours(0, 0, 0, 0);
    return {
      used: data.daily_used,
      limit: data.daily_limit,
      resetAt: resetAt.toISOString(),
      planType: data.plan_type
    };
  }
};

module.exports = aiQuotaService;



