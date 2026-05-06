import { supabase } from "../lib/supabase.js";

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundTo2(value) {
  return Math.round(value * 100) / 100;
}

function aggregateRatings(rows, idField, ratingField) {
  const buckets = new Map();

  for (const row of rows ?? []) {
    const entityId = row?.[idField];
    const rating = toNumber(row?.[ratingField]);
    if (!entityId || rating == null) {
      continue;
    }

    const current = buckets.get(entityId) ?? { sum: 0, count: 0 };
    current.sum += rating;
    current.count += 1;
    buckets.set(entityId, current);
  }

  return buckets;
}

function mapToRankingEntries(buckets, resolveIdentity) {
  const entries = [];

  for (const [entityId, score] of buckets.entries()) {
    if (!score?.count) {
      continue;
    }

    const identity = resolveIdentity(entityId);
    if (!identity) {
      continue;
    }

    entries.push({
      ...identity,
      average: roundTo2(score.sum / score.count),
      count: score.count,
    });
  }

  return entries.sort((a, b) => {
    if (b.average !== a.average) {
      return b.average - a.average;
    }
    return b.count - a.count;
  });
}

async function listRowsForStudentRatings() {
  const { data, error } = await supabase
    .from("company_progress")
    .select("student_id, student_assessment_rating")
    .not("student_assessment_rating", "is", null);

  if (error) {
    console.warn("[publicRatingsService] listRowsForStudentRatings error:", error);
    return [];
  }

  return data ?? [];
}

async function listRowsForCompanyRatings() {
  const { data, error } = await supabase
    .from("company_progress")
    .select("partner_id, company_assessment_rating, company_assessment_text, updated_at")
    .not("company_assessment_rating", "is", null);

  if (error) {
    console.warn("[publicRatingsService] listRowsForCompanyRatings error:", error);
    return [];
  }

  return data ?? [];
}

async function getStudentAccountsByStudentIds(studentIds) {
  if (!studentIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("student_accounts")
    .select("id, student_id")
    .in("student_id", studentIds);

  if (error) {
    console.warn("[publicRatingsService] getStudentAccountsByStudentIds error:", error);
    return [];
  }

  return data ?? [];
}

async function getUserProfilesByIds(userIds) {
  if (!userIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, display_name, avatar_url, type")
    .in("id", userIds);

  if (error) {
    console.warn("[publicRatingsService] getUserProfilesByIds error:", error);
    return [];
  }

  return data ?? [];
}

async function getPartnersByIds(partnerIds) {
  if (!partnerIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("partners")
    .select("id, empresa, photo_preview, created_by")
    .in("id", partnerIds);

  if (error) {
    console.warn("[publicRatingsService] getPartnersByIds error:", error);
    return [];
  }

  return data ?? [];
}

export async function getPublicRatingSummary({ userId, profileType }) {
  if (!supabase || !userId || !profileType) {
    return null;
  }

  if (profileType === "student") {
    const { data: studentAccount, error: accountError } = await supabase
      .from("student_accounts")
      .select("student_id")
      .eq("id", userId)
      .maybeSingle();

    if (accountError || !studentAccount?.student_id) {
      return { average: null, count: 0, comments: [] };
    }

    const { data: rows, error } = await supabase
      .from("company_progress")
      .select("student_assessment_rating")
      .eq("student_id", studentAccount.student_id)
      .not("student_assessment_rating", "is", null);

    if (error || !rows?.length) {
      return { average: null, count: 0, comments: [] };
    }

    const scores = rows
      .map((row) => toNumber(row?.student_assessment_rating))
      .filter((value) => value != null);

    if (!scores.length) {
      return { average: null, count: 0, comments: [] };
    }

    const sum = scores.reduce((acc, value) => acc + value, 0);
    return {
      average: roundTo2(sum / scores.length),
      count: scores.length,
      comments: [],
    };
  }

  if (profileType === "company") {
    const { data: partners, error: partnerError } = await supabase
      .from("partners")
      .select("id")
      .eq("created_by", userId);

    const partnerIds = (partners ?? []).map((partner) => partner.id).filter(Boolean);

    if (partnerError || !partnerIds.length) {
      return { average: null, count: 0, comments: [] };
    }

    const { data: rows, error } = await supabase
      .from("company_progress")
      .select("company_assessment_rating, company_assessment_text, updated_at")
      .in("partner_id", partnerIds)
      .not("company_assessment_rating", "is", null)
      .order("updated_at", { ascending: false });

    if (error || !rows?.length) {
      return { average: null, count: 0, comments: [] };
    }

    const scores = rows
      .map((row) => toNumber(row?.company_assessment_rating))
      .filter((value) => value != null);

    if (!scores.length) {
      return { average: null, count: 0, comments: [] };
    }

    const comments = rows
      .map((row) => String(row?.company_assessment_text ?? "").trim())
      .filter(Boolean)
      .slice(0, 3);

    const sum = scores.reduce((acc, value) => acc + value, 0);
    return {
      average: roundTo2(sum / scores.length),
      count: scores.length,
      comments,
    };
  }

  return { average: null, count: 0, comments: [] };
}

export async function listTopRatedStudents(limit = 10) {
  if (!supabase) {
    return [];
  }

  const rows = await listRowsForStudentRatings();
  if (!rows.length) {
    return [];
  }

  const buckets = aggregateRatings(rows, "student_id", "student_assessment_rating");
  const studentIds = Array.from(buckets.keys());
  const studentAccounts = await getStudentAccountsByStudentIds(studentIds);
  const studentToUser = new Map(
    studentAccounts
      .filter((row) => row?.student_id && row?.id)
      .map((row) => [row.student_id, row.id])
  );

  const userIds = Array.from(new Set(studentAccounts.map((row) => row.id).filter(Boolean)));
  const profiles = await getUserProfilesByIds(userIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const ranking = mapToRankingEntries(buckets, (studentId) => {
    const userId = studentToUser.get(studentId);
    const profile = userId ? profileById.get(userId) : null;
    if (!userId || !profile) {
      return null;
    }

    return {
      userId,
      entityId: studentId,
      displayName: profile.display_name || "Aluno",
      avatarUrl: profile.avatar_url || null,
      profileType: "student",
    };
  });

  return ranking.slice(0, Math.max(1, limit));
}

export async function listTopRatedCompanies(limit = 10) {
  if (!supabase) {
    return [];
  }

  const rows = await listRowsForCompanyRatings();
  if (!rows.length) {
    return [];
  }

  const buckets = aggregateRatings(rows, "partner_id", "company_assessment_rating");
  const partnerIds = Array.from(buckets.keys());
  const partners = await getPartnersByIds(partnerIds);
  const partnersById = new Map(partners.map((partner) => [partner.id, partner]));

  const profileIds = Array.from(
    new Set(
      partners
        .map((partner) => partner.created_by)
        .filter(Boolean)
    )
  );
  const profiles = await getUserProfilesByIds(profileIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const ranking = mapToRankingEntries(buckets, (partnerId) => {
    const partner = partnersById.get(partnerId);
    if (!partner) {
      return null;
    }

    const profile = partner.created_by ? profileById.get(partner.created_by) : null;
    return {
      userId: partner.created_by || null,
      entityId: partner.id,
      displayName: partner.empresa || profile?.display_name || "Empresa",
      avatarUrl: partner.photo_preview || profile?.avatar_url || null,
      profileType: "company",
    };
  });

  return ranking.slice(0, Math.max(1, limit));
}

async function listAllRankedStudents() {
  if (!supabase) {
    return [];
  }

  const rows = await listRowsForStudentRatings();
  if (!rows.length) {
    return [];
  }

  const buckets = aggregateRatings(rows, "student_id", "student_assessment_rating");
  const studentIds = Array.from(buckets.keys());
  const studentAccounts = await getStudentAccountsByStudentIds(studentIds);
  const studentToUser = new Map(
    studentAccounts
      .filter((row) => row?.student_id && row?.id)
      .map((row) => [row.student_id, row.id])
  );

  const userIds = Array.from(new Set(studentAccounts.map((row) => row.id).filter(Boolean)));
  const profiles = await getUserProfilesByIds(userIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return mapToRankingEntries(buckets, (studentId) => {
    const userId = studentToUser.get(studentId);
    const profile = userId ? profileById.get(userId) : null;
    if (!userId || !profile) {
      return null;
    }

    return {
      userId,
      entityId: studentId,
      displayName: profile.display_name || "Aluno",
      avatarUrl: profile.avatar_url || null,
      profileType: "student",
    };
  });
}

async function listAllRankedCompanies() {
  if (!supabase) {
    return [];
  }

  const rows = await listRowsForCompanyRatings();
  if (!rows.length) {
    return [];
  }

  const buckets = aggregateRatings(rows, "partner_id", "company_assessment_rating");
  const partnerIds = Array.from(buckets.keys());
  const partners = await getPartnersByIds(partnerIds);
  const partnersById = new Map(partners.map((partner) => [partner.id, partner]));

  const profileIds = Array.from(
    new Set(
      partners
        .map((partner) => partner.created_by)
        .filter(Boolean)
    )
  );
  const profiles = await getUserProfilesByIds(profileIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return mapToRankingEntries(buckets, (partnerId) => {
    const partner = partnersById.get(partnerId);
    if (!partner) {
      return null;
    }

    const profile = partner.created_by ? profileById.get(partner.created_by) : null;
    return {
      userId: partner.created_by || null,
      entityId: partner.id,
      displayName: partner.empresa || profile?.display_name || "Empresa",
      avatarUrl: partner.photo_preview || profile?.avatar_url || null,
      profileType: "company",
    };
  });
}

export async function getPublicRankingPosition({ userId, profileType }) {
  if (!supabase || !userId || !profileType) {
    return null;
  }

  const type = String(profileType).trim().toLowerCase();
  if (type !== "student" && type !== "company") {
    return null;
  }

  const ranking = type === "student"
    ? await listAllRankedStudents()
    : await listAllRankedCompanies();

  if (!ranking.length) {
    return null;
  }

  const index = ranking.findIndex((entry) => entry.userId === userId);
  if (index < 0) {
    return { position: null, total: ranking.length };
  }

  return { position: index + 1, total: ranking.length };
}
