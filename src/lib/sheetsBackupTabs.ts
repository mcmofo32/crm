import { prisma } from "@/lib/prisma";
import { ROLE_LABELS, LEAD_TYPE_LABELS, leadStatusLabel } from "@/lib/roleLabels";
import { PRODUCT_TYPE_LABELS } from "@/lib/productTypes";
import {
  INSURANCE_COMPANY_LABELS,
  POLICY_STATUS_LABELS,
} from "@/lib/policyLabels";
import { GOAL_METRIC_LABELS, KPI_METRIC_LABELS, MONTH_LABELS } from "@/lib/goalLabels";

export type SheetsBackupTab = {
  /** Titel van het tabblad in Google Sheets — moet uniek zijn. */
  name: string;
  headers: string[];
  fetchRows: () => Promise<(string | number | null)[][]>;
};

function fmtDate(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleDateString("nl-BE", {
    dateStyle: "medium",
    timeZone: "Europe/Brussels",
  });
}

function fmtDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleString("nl-BE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Brussels",
  });
}

function fmtAmount(value: unknown): string {
  if (value === null || value === undefined) return "";
  return Number(value).toLocaleString("nl-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function fmtNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function fmtBool(value: boolean): string {
  return value ? "Ja" : "Nee";
}

const usersTab: SheetsBackupTab = {
  name: "Gebruikers",
  headers: [
    "Naam",
    "E-mail",
    "Telefoon",
    "Rol",
    "Team",
    "Functie",
    "Type",
    "Actief",
    "Google Agenda gekoppeld",
    "Zoom-link",
    "Aangemaakt op",
  ],
  fetchRows: async () => {
    const users = await prisma.user.findMany({
      include: { team: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return users.map((u) => [
      u.name,
      u.email ?? "",
      u.phone ?? "",
      ROLE_LABELS[u.role],
      u.team?.name ?? "",
      u.jobFunction ?? "",
      u.agentType === "SUBAGENT" ? "Subagent" : "Analist",
      fmtBool(u.active),
      fmtBool(u.googleCalendarConnected),
      u.zoomLink ?? "",
      fmtDate(u.createdAt),
    ]);
  },
};

const teamsTab: SheetsBackupTab = {
  name: "Teams",
  headers: ["Naam", "Coach", "Aantal leden", "Aangemaakt op"],
  fetchRows: async () => {
    const teams = await prisma.team.findMany({
      include: { coach: { select: { name: true } }, members: { select: { id: true } } },
      orderBy: { name: "asc" },
    });
    return teams.map((t) => [t.name, t.coach.name, t.members.length, fmtDate(t.createdAt)]);
  },
};

const subagentsTab: SheetsBackupTab = {
  name: "Subagenten",
  headers: ["Naam", "E-mail", "Telefoon", "Team", "Gekoppelde gebruiker", "Actief", "Aangemaakt op"],
  fetchRows: async () => {
    const subagents = await prisma.subagent.findMany({
      include: { team: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return subagents.map((s) => [
      s.name,
      s.email,
      s.phone ?? "",
      s.team.name,
      s.user?.name ?? "",
      fmtBool(s.active),
      fmtDate(s.createdAt),
    ]);
  },
};

const leadsTab: SheetsBackupTab = {
  name: "Leads",
  headers: [
    "Voornaam",
    "Achternaam",
    "E-mail",
    "Telefoon",
    "Bedrijf",
    "Type",
    "Status",
    "Fase",
    "Eigenaar",
    "Bron",
    "Waarde",
    "Dossierbeheerder",
    "Belastingaangifte",
    "Kwaliteitsscore",
    "Geïnformeerd",
    "Bericht verstuurd",
    "Kenmerken",
    "Aangemaakt op",
    "Laatste contact",
    "Verwijderd op",
  ],
  fetchRows: async () => {
    const leads = await prisma.lead.findMany({
      include: {
        stage: { select: { label: true } },
        owner: { select: { name: true } },
        caseManagerUser: { select: { name: true } },
        caseManagerSubagent: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return leads.map((l) => [
      l.firstName,
      l.lastName,
      l.email ?? "",
      l.phone ?? "",
      l.company ?? "",
      LEAD_TYPE_LABELS[l.leadType],
      leadStatusLabel(l.status, l.leadType),
      l.stage.label,
      l.owner.name,
      l.source ?? "",
      l.value !== null ? fmtAmount(l.value) : "",
      l.caseManagerUser?.name ?? l.caseManagerSubagent?.name ?? "",
      l.taxDeclarationStatus ?? "",
      l.qualityScore ?? "",
      fmtBool(l.isInformed),
      fmtBool(l.messageSent),
      l.characteristics ?? "",
      fmtDate(l.createdAt),
      fmtDate(l.lastContactedAt),
      fmtDate(l.deletedAt),
    ]);
  },
};

const productsTab: SheetsBackupTab = {
  name: "Producten",
  headers: [
    "Klant",
    "Type",
    "Bedrag",
    "Eenheden",
    "Contractdatum",
    "Vervolgcontract",
    "Aangemaakt op",
  ],
  fetchRows: async () => {
    const products = await prisma.leadProduct.findMany({
      include: { lead: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return products.map((p) => [
      `${p.lead.firstName} ${p.lead.lastName}`,
      PRODUCT_TYPE_LABELS[p.type],
      fmtAmount(p.amount),
      p.units,
      fmtDate(p.contractDate),
      fmtBool(p.isFollowUp),
      fmtDate(p.createdAt),
    ]);
  },
};

const policiesTab: SheetsBackupTab = {
  name: "Polissen",
  headers: [
    "Datum",
    "Medewerker",
    "Klant",
    "Eenheden",
    "Product",
    "Maatschappij",
    "Status",
    "Easy",
    "Tool",
    "RL",
    "SA File",
    "CC File",
    "Ingangsdatum",
    "Betaald",
  ],
  fetchRows: async () => {
    const policies = await prisma.policy.findMany({
      include: {
        lead: { select: { firstName: true, lastName: true } },
        leadProduct: { select: { type: true, units: true } },
        employee: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return policies.map((p) => [
      fmtDate(p.createdAt),
      p.employee.name,
      `${p.lead.firstName} ${p.lead.lastName}`,
      p.leadProduct.units,
      PRODUCT_TYPE_LABELS[p.leadProduct.type],
      p.company ? INSURANCE_COMPANY_LABELS[p.company] : "",
      POLICY_STATUS_LABELS[p.status],
      fmtBool(p.easy),
      fmtBool(p.tool),
      fmtBool(p.rl),
      fmtBool(p.saFile),
      fmtBool(p.ccFile),
      fmtDate(p.ingangsdatum),
      fmtDate(p.betaaldOp),
    ]);
  },
};

const activitiesTab: SheetsBackupTab = {
  name: "Activiteiten",
  headers: [
    "Lead",
    "Type",
    "Status",
    "Onderwerp",
    "Toegewezen aan",
    "Ingepland op",
    "Duur (min)",
    "Afgerond op",
    "Voicemail",
    "Locatie/modus",
    "Notities",
  ],
  fetchRows: async () => {
    const activities = await prisma.activity.findMany({
      include: {
        lead: { select: { firstName: true, lastName: true } },
        assignee: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return activities.map((a) => [
      `${a.lead.firstName} ${a.lead.lastName}`,
      a.type,
      a.status,
      a.subject,
      a.assignee.name,
      fmtDateTime(a.scheduledAt),
      a.durationMinutes ?? "",
      fmtDateTime(a.completedAt),
      fmtBool(a.wasVoicemail),
      a.meetingMode ? `${a.meetingMode}${a.location ? ` — ${a.location}` : ""}` : "",
      a.notes ?? "",
    ]);
  },
};

const stageChangesTab: SheetsBackupTab = {
  name: "Fasewijzigingen",
  headers: ["Lead", "Van fase", "Naar fase", "Door", "Wanneer"],
  fetchRows: async () => {
    const changes = await prisma.leadStageChange.findMany({
      include: {
        lead: { select: { firstName: true, lastName: true } },
        fromStage: { select: { label: true } },
        toStage: { select: { label: true } },
        changedBy: { select: { name: true } },
      },
      orderBy: { changedAt: "desc" },
    });
    return changes.map((c) => [
      `${c.lead.firstName} ${c.lead.lastName}`,
      c.fromStage?.label ?? "(nieuw)",
      c.toStage.label,
      c.changedBy.name,
      fmtDateTime(c.changedAt),
    ]);
  },
};

const weeklyGoalsTab: SheetsBackupTab = {
  name: "Doelen wekelijks",
  headers: ["Gebruiker", "Doel", "Streefwaarde"],
  fetchRows: async () => {
    const goals = await prisma.userGoal.findMany({
      include: { user: { select: { name: true } } },
      orderBy: [{ user: { name: "asc" } }, { metric: "asc" }],
    });
    return goals.map((g) => [g.user.name, GOAL_METRIC_LABELS[g.metric], fmtNumber(g.target)]);
  },
};

const productionMonthsTab: SheetsBackupTab = {
  name: "Productiemaanden",
  headers: ["Jaar", "Maand", "Begindatum", "Einddatum"],
  fetchRows: async () => {
    const months = await prisma.productionMonth.findMany({
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });
    return months.map((m) => [m.year, MONTH_LABELS[m.month - 1], fmtDate(m.startDate), fmtDate(m.endDate)]);
  },
};

const monthlyGoalsTab: SheetsBackupTab = {
  name: "Doelen per productiemaand",
  headers: ["Gebruiker", "Jaar", "Maand", "Doel", "Streefwaarde"],
  fetchRows: async () => {
    const goals = await prisma.userMonthlyGoal.findMany({
      include: { user: { select: { name: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }, { user: { name: "asc" } }],
    });
    return goals.map((g) => [
      g.user.name,
      g.year,
      MONTH_LABELS[g.month - 1],
      GOAL_METRIC_LABELS[g.metric],
      fmtNumber(g.target),
    ]);
  },
};

const kpiGoalsTab: SheetsBackupTab = {
  name: "KPI-doelen jaarlijks",
  headers: ["Gebruiker", "Jaar", "KPI", "Streefwaarde"],
  fetchRows: async () => {
    const goals = await prisma.userKpiGoal.findMany({
      include: { user: { select: { name: true } } },
      orderBy: [{ year: "desc" }, { user: { name: "asc" } }],
    });
    return goals.map((g) => [g.user.name, g.year, KPI_METRIC_LABELS[g.metric], fmtNumber(g.target)]);
  },
};

const kpiMonthlyEntriesTab: SheetsBackupTab = {
  name: "KPI maandelijkse invoer",
  headers: ["Gebruiker", "Jaar", "Maand", "KPI", "Waarde"],
  fetchRows: async () => {
    const entries = await prisma.userKpiMonthlyEntry.findMany({
      include: { user: { select: { name: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }, { user: { name: "asc" } }],
    });
    return entries.map((e) => [
      e.user.name,
      e.year,
      MONTH_LABELS[e.month - 1],
      KPI_METRIC_LABELS[e.metric],
      fmtNumber(e.value),
    ]);
  },
};

const funnelStagesTab: SheetsBackupTab = {
  name: "Funnelfases",
  headers: ["Type", "Fase", "Sleutel", "Volgorde", "Kleur", "Klant/gewonnen", "Verloren"],
  fetchRows: async () => {
    const stages = await prisma.funnelStage.findMany({
      orderBy: [{ leadType: "asc" }, { order: "asc" }],
    });
    return stages.map((s) => [
      LEAD_TYPE_LABELS[s.leadType],
      s.label,
      s.key,
      s.order,
      s.color,
      fmtBool(s.isWon),
      fmtBool(s.isLost),
    ]);
  },
};

const incentivesTab: SheetsBackupTab = {
  name: "Incentives",
  headers: [
    "Titel",
    "Modus",
    "Ranglijst-doel",
    "Ranglijst-leadtype",
    "Top N",
    "Begin",
    "Eind",
    "Aangemaakt door",
    "Aangemaakt op",
  ],
  fetchRows: async () => {
    const incentives = await prisma.incentive.findMany({
      include: { createdBy: { select: { name: true } } },
      orderBy: { startDate: "desc" },
    });
    return incentives.map((i) => [
      i.title,
      i.mode,
      i.rankingMetric ?? "",
      i.rankingLeadType ? LEAD_TYPE_LABELS[i.rankingLeadType] : "",
      i.topN ?? "",
      fmtDate(i.startDate),
      fmtDate(i.endDate),
      i.createdBy.name,
      fmtDate(i.createdAt),
    ]);
  },
};

const incentiveCategoriesTab: SheetsBackupTab = {
  name: "Incentive-categorieën",
  headers: ["Incentive", "Meting", "Leadtype", "Richtcijfer", "Volgorde"],
  fetchRows: async () => {
    const categories = await prisma.incentiveCategory.findMany({
      include: { incentive: { select: { title: true } } },
      orderBy: [{ incentive: { startDate: "desc" } }, { order: "asc" }],
    });
    return categories.map((c) => [
      c.incentive.title,
      c.metric,
      c.leadType ? LEAD_TYPE_LABELS[c.leadType] : "FA + RG",
      c.targetValue,
      c.order,
    ]);
  },
};

const eventsTab: SheetsBackupTab = {
  name: "Evenementen",
  headers: [
    "Titel",
    "Type",
    "Datum",
    "Locatie",
    "Beschrijving",
    "Aangemaakt door",
    "Geverifieerd op",
    "Geverifieerd door",
  ],
  fetchRows: async () => {
    const events = await prisma.event.findMany({
      include: {
        createdBy: { select: { name: true } },
        verifiedBy: { select: { name: true } },
      },
      orderBy: { date: "desc" },
    });
    return events.map((e) => [
      e.title,
      e.type,
      fmtDateTime(e.date),
      e.location ?? "",
      e.description ?? "",
      e.createdBy.name,
      fmtDateTime(e.verifiedAt),
      e.verifiedBy?.name ?? "",
    ]);
  },
};

const eventAttendancesTab: SheetsBackupTab = {
  name: "Aanwezigheden",
  headers: ["Evenement", "Gebruiker", "RSVP", "Effectieve aanwezigheid"],
  fetchRows: async () => {
    const attendances = await prisma.eventAttendance.findMany({
      include: {
        event: { select: { title: true, date: true } },
        user: { select: { name: true } },
      },
      orderBy: { event: { date: "desc" } },
    });
    return attendances.map((a) => [
      `${a.event.title} (${fmtDate(a.event.date)})`,
      a.user.name,
      a.status,
      a.actualStatus ?? "",
    ]);
  },
};

const auditLogTab: SheetsBackupTab = {
  name: "Auditlog",
  headers: ["Actie", "Entiteit", "Beschrijving", "Door", "Wanneer"],
  fetchRows: async () => {
    const entries = await prisma.auditLog.findMany({
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    return entries.map((e) => [
      e.action,
      `${e.entityType} (${e.entityId})`,
      e.description,
      e.actor.name,
      fmtDateTime(e.createdAt),
    ]);
  },
};

/** Volgorde van de tabbladen in het back-up Google Sheets-bestand. */
export const SHEETS_BACKUP_TABS: SheetsBackupTab[] = [
  leadsTab,
  productsTab,
  policiesTab,
  activitiesTab,
  stageChangesTab,
  usersTab,
  teamsTab,
  subagentsTab,
  weeklyGoalsTab,
  productionMonthsTab,
  monthlyGoalsTab,
  kpiGoalsTab,
  kpiMonthlyEntriesTab,
  incentivesTab,
  incentiveCategoriesTab,
  eventsTab,
  eventAttendancesTab,
  funnelStagesTab,
  auditLogTab,
];
