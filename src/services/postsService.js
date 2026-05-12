import { supabase } from "../lib/supabase.js";

const POST_SELECT = `
  id, content, image_url, visibility, moderation, is_official, created_at,
  author:user_profiles!author_id (id, display_name, avatar_url, type),
  reactions:post_reactions (id, user_id, type),
  comments_count:post_comments (count),
  shares_count:post_shares (count),
  poll:post_polls (id, question, options, ends_at, votes:post_poll_votes (user_id, option_idx))
`;

/**
 * Lista posts do feed (aprovados), paginados por cursor (created_at).
 */
export async function getFeedPosts(cursor = null, limit = 20) {
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("moderation", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Cria um novo post. Opcionalmente faz upload de imagem para o bucket "posts".
 */
export async function createPost(content, imageFile = null) {
  const { data: { user } } = await supabase.auth.getUser();
  let image_url = null;

  if (imageFile) {
    const ext = imageFile.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("posts")
      .upload(path, imageFile);
    if (uploadErr) throw uploadErr;
    const { data: urlData } = supabase.storage.from("posts").getPublicUrl(path);
    image_url = urlData.publicUrl;
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({ author_id: user.id, content, image_url })
    .select(POST_SELECT)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Reage a um post. Se a reação já existe, remove-a (toggle).
 */
export async function toggleReaction(postId, type) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: existing } = await supabase
    .from("post_reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .eq("type", type)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("post_reactions").delete().eq("id", existing.id);
    if (error) throw error;
    return false; // removeu
  }

  const { error } = await supabase
    .from("post_reactions")
    .insert({ post_id: postId, user_id: user.id, type });
  if (error) throw error;
  return true; // adicionou
}

/**
 * Lista comentários de um post.
 */
export async function getComments(postId) {
  const { data, error } = await supabase
    .from("post_comments")
    .select("id, content, parent_id, created_at, author:user_profiles!author_id (id, display_name, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Adiciona um comentário a um post.
 */
export async function addComment(postId, content, parentId = null) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, author_id: user.id, content, parent_id: parentId })
    .select("id, content, parent_id, created_at, author:user_profiles!author_id (id, display_name, avatar_url)")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove o próprio comentário.
 */
export async function deleteComment(commentId) {
  const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
  if (error) throw error;
}

/**
 * Partilha um post internamente.
 */
export async function sharePost(postId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("post_shares")
    .insert({ post_id: postId, user_id: user.id });
  // Duplicado: o utilizador já partilhou este post.
  if (error) {
    if (error.code === "23505" || error.message?.includes("duplicate")) return false;
    throw error;
  }
  return true;
}

/** Devolve URL pública para partilha externa de um post. */
export function getPublicPostUrl(postId) {
  if (typeof window === "undefined") return `/post/${postId}`;
  return new URL(`/post/${postId}`, window.location.origin).toString();
}

/** Obtém um post aprovado para visualização pública direta. */
export async function getPublicPostById(postId) {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .eq("moderation", "approved")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Subscreve ao feed em tempo real. Devolve uma função de unsubscribe.
 */
export function subscribeToFeed(callback) {
  const channel = supabase
    .channel("realtime:posts")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, callback)
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/**
 * Aprova ou rejeita um post (admin).
 */
export async function moderatePost(postId, status) {
  const { error } = await supabase
    .from("posts")
    .update({ moderation: status })
    .eq("id", postId);
  if (error) throw error;
}

// ── Bookmarks ─────────────────────────────────────────────────

/** Toggle bookmark num post. Devolve true se guardou, false se removeu. */
export async function toggleBookmark(postId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: existing } = await supabase
    .from("post_bookmarks")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("post_bookmarks").delete().eq("id", existing.id);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase
    .from("post_bookmarks")
    .insert({ post_id: postId, user_id: user.id });
  if (error) throw error;
  return true;
}

/** Lista IDs dos posts guardados pelo utilizador autenticado. */
export async function getBookmarkedPostIds() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("post_bookmarks")
    .select("post_id")
    .eq("user_id", user.id);
  if (error) throw error;
  return (data ?? []).map((b) => b.post_id);
}

/** Lista posts guardados pelo utilizador autenticado. */
export async function getBookmarkedPosts() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: bookmarks, error: bErr } = await supabase
    .from("post_bookmarks")
    .select("post_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (bErr) throw bErr;
  if (!bookmarks || bookmarks.length === 0) return [];

  const ids = bookmarks.map((b) => b.post_id);
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── Polls ─────────────────────────────────────────────────────

/** Cria um post com sondagem. */
export async function createPollPost(content, question, options, durationHours = 24) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: post, error: postErr } = await supabase
    .from("posts")
    .insert({ author_id: user.id, content })
    .select("id")
    .single();
  if (postErr) throw postErr;

  const ends_at = new Date(Date.now() + durationHours * 3600000).toISOString();
  const { error: pollErr } = await supabase
    .from("post_polls")
    .insert({ post_id: post.id, question, options: JSON.stringify(options), ends_at });
  if (pollErr) throw pollErr;

  // Recarregar com JOINs
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", post.id)
    .single();
  if (error) throw error;
  return data;
}

/** Vota numa opção de sondagem (upsert via função SQL). */
export async function votePoll(pollId, optionIdx) {
  const { error } = await supabase.rpc("vote_on_poll", {
    p_poll_id: pollId,
    p_option_idx: optionIdx,
  });
  if (error) throw error;
}

/** Lista posts com moderação pendente (admin). */
export async function getPendingPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("moderation", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Atualiza o conteúdo de um post (dono apenas).
 */
export async function updatePost(postId, content) {
  const { data: { user } } = await supabase.auth.getUser();

  // Verificar se o utilizador é dono do post
  const { data: post } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  if (!post || post.author_id !== user.id) {
    throw new Error("Permissão insuficiente para editar este post.");
  }

  const { data, error } = await supabase
    .from("posts")
    .update({ content })
    .eq("id", postId)
    .select(POST_SELECT)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Elimina um post (dono apenas).
 */
export async function deletePost(postId) {
  const { data: { user } } = await supabase.auth.getUser();

  // Verificar se o utilizador é dono do post
  const { data: post } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  if (!post || post.author_id !== user.id) {
    throw new Error("Permissão insuficiente para eliminar este post.");
  }

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId);

  if (error) throw error;
}
