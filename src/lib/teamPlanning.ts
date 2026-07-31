import { Role } from "@/generated/prisma/client";

export type PlanningTeamMember = { id: string; name: string; role: Role };

export type PlanningTeam = {
  id: string;
  coachId: string;
  members: PlanningTeamMember[];
};

export type PlanningUser = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  teamId: string | null;
};

/**
 * Berekent alle team-/kandidatenlijsten voor de Teams-pagina volledig in het
 * geheugen, op basis van drie eenmalige bulk-queries (teams, subagenten,
 * gebruikers) die al bij het laden van de pagina gebeuren. Voorheen deed elk
 * team-kaartje en elk teamlid apart nog eigen database-rondjes (inclusief
 * recursieve cirkel-checks) — bij een organisatie met wat meer mensen liep
 * dat snel op tot tientallen extra queries per paginabezoek, wat de pagina
 * merkbaar traag maakte. Hier gebeurt alles éénmalig, synchroon, zonder
 * extra databasetoegang.
 */
export class TeamPlanningContext {
  private teamByCoachId = new Map<string, PlanningTeam>();
  private subagentCountByTeamId = new Map<string, number>();
  private descendantCache = new Map<string, Set<string>>();

  constructor(
    teams: PlanningTeam[],
    private allUsers: PlanningUser[],
    subagents: { teamId: string }[]
  ) {
    for (const t of teams) this.teamByCoachId.set(t.coachId, t);
    for (const s of subagents) {
      this.subagentCountByTeamId.set(
        s.teamId,
        (this.subagentCountByTeamId.get(s.teamId) ?? 0) + 1
      );
    }
  }

  private descendantsOf(coachId: string, seen: Set<string> = new Set()): Set<string> {
    const cached = this.descendantCache.get(coachId);
    if (cached) return cached;
    if (seen.has(coachId)) return new Set();
    seen.add(coachId);

    const team = this.teamByCoachId.get(coachId);
    const result = new Set<string>();
    if (team) {
      for (const member of team.members) {
        if (result.has(member.id)) continue;
        result.add(member.id);
        if (member.role === Role.COACH) {
          for (const id of this.descendantsOf(member.id, seen)) result.add(id);
        }
      }
    }
    this.descendantCache.set(coachId, result);
    return result;
  }

  /** Zou het aanduiden van `candidateId` als coach boven `targetCoachId` een cirkel geven? */
  wouldCreateCycle(candidateId: string, targetCoachId: string): boolean {
    if (candidateId === targetCoachId) return true;
    return this.descendantsOf(candidateId).has(targetCoachId);
  }

  /** Gebruikers die als coach van een NIEUW team aangeduid kunnen worden. */
  coachCandidates() {
    return this.allUsers
      .filter((u) => u.role !== Role.BEHEERDER && !this.teamByCoachId.has(u.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Gebruikers die als lid aan een team toegevoegd kunnen worden. */
  memberCandidates() {
    return this.allUsers
      .filter((u) => u.role === Role.USER || u.role === Role.COACH)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Iedereen die onder dit team valt, ook via geneste sub-structuren. */
  structureMembers(team: PlanningTeam) {
    const ids = this.descendantsOf(team.coachId);
    if (ids.size === 0) return [];
    return this.allUsers
      .filter((u) => ids.has(u.id))
      .map((u) => ({ id: u.id, name: u.name, role: u.role }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Gebruikers die de coach van een bestaand team kunnen vervangen. */
  coachChangeCandidates(team: PlanningTeam) {
    const descendantIds = this.descendantsOf(team.coachId);
    return this.allUsers
      .filter((c) => c.role !== Role.BEHEERDER)
      .filter((c) => c.id !== team.coachId && !descendantIds.has(c.id))
      .filter((c) => {
        const ownTeam = this.teamByCoachId.get(c.id);
        if (!ownTeam) return true;
        const subagentCount = this.subagentCountByTeamId.get(ownTeam.id) ?? 0;
        return ownTeam.members.length === 0 && subagentCount === 0;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Gebruikers die rechtstreeks onder `personId` geplaatst kunnen worden. */
  subordinateCandidates(personId: string) {
    const ownTeam = this.teamByCoachId.get(personId);
    const existingMemberIds = new Set((ownTeam?.members ?? []).map((m) => m.id));
    return this.allUsers
      .filter((c) => c.role === Role.USER || c.role === Role.COACH)
      .filter((c) => c.id !== personId && !existingMemberIds.has(c.id))
      .filter((c) => c.role !== Role.COACH || !this.descendantsOf(c.id).has(personId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
