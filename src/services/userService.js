const supabase = require('../config/supabase');

async function searchUsersInWorkspace(query, workspaceId, requesterId, limit = 10) {
  if (!query || !workspaceId) return [];

  const q = query.trim().toLowerCase();

  const { data: members, error: memberError } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .neq('user_id', requesterId);

  if (memberError) throw memberError;
  if (!members || members.length === 0) return [];

  const userIds = members.map(m => m.user_id);

  const orQuery = "name.ilike.%" + q + "%,email.ilike.%" + q + "%";

  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, name, email, avatar_url')
    .in('id', userIds)
    .or(orQuery)
    .limit(limit);

  if (profileError) throw profileError;

  return (profiles || []).map(p => ({
    id: p.id,
    name: p.name || p.email,
    email: p.email,
    avatar_url: p.avatar_url || null,
  }));
}

module.exports = { searchUsersInWorkspace };
