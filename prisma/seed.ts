import bcrypt from "bcryptjs";
import { PrismaClient, Role, LeadType } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const FA_STAGES = [
  { key: "nieuw", label: "Nieuwe lead", order: 0 },
  { key: "contact", label: "Eerste contact", order: 1 },
  { key: "afspraak", label: "Afspraak gepland", order: 2 },
  { key: "analyse", label: "Financiële analyse uitgevoerd", order: 3 },
  { key: "voorstel", label: "Voorstel verzonden", order: 4 },
  { key: "gewonnen", label: "Klant", order: 5, isWon: true },
  { key: "verloren", label: "Verloren", order: 6, isLost: true },
];

const RG_STAGES = [
  { key: "nieuw", label: "Nieuwe lead", order: 0 },
  { key: "contact", label: "Eerste contact", order: 1 },
  { key: "behoefte", label: "Behoefte in kaart gebracht", order: 2 },
  { key: "offerte", label: "Offerte verzonden", order: 3 },
  { key: "gewonnen", label: "Contract getekend", order: 4, isWon: true },
  { key: "verloren", label: "Verloren", order: 5, isLost: true },
];

async function seedStages(leadType: LeadType, stages: typeof FA_STAGES) {
  const result = [];
  for (const stage of stages) {
    result.push(
      await prisma.funnelStage.upsert({
        where: { leadType_key: { leadType, key: stage.key } },
        update: {
          label: stage.label,
          order: stage.order,
          isWon: stage.isWon ?? false,
          isLost: stage.isLost ?? false,
        },
        create: {
          leadType,
          key: stage.key,
          label: stage.label,
          order: stage.order,
          isWon: stage.isWon ?? false,
          isLost: stage.isLost ?? false,
        },
      })
    );
  }
  return result;
}

async function upsertUser(data: {
  name: string;
  email: string;
  password: string;
  role: Role;
  teamId?: string;
}) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  return prisma.user.upsert({
    where: { email: data.email },
    update: {},
    create: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      teamId: data.teamId,
    },
  });
}

async function main() {
  const faStages = await seedStages(LeadType.FA, FA_STAGES);
  const rgStages = await seedStages(LeadType.RG, RG_STAGES);

  const beheerder = await upsertUser({
    name: "Robin (Beheerder)",
    email: "beheerder@ceuppensconsulting.com",
    password: "Wijzig-Dit-Wachtwoord!1",
    role: Role.BEHEERDER,
  });

  const admin = await upsertUser({
    name: "Voorbeeld Admin",
    email: "admin@ceuppensconsulting.com",
    password: "Wijzig-Dit-Wachtwoord!1",
    role: Role.ADMIN,
  });

  const coach = await upsertUser({
    name: "Voorbeeld Coach",
    email: "coach@ceuppensconsulting.com",
    password: "Wijzig-Dit-Wachtwoord!1",
    role: Role.COACH,
  });

  const team = await prisma.team.upsert({
    where: { coachId: coach.id },
    update: {},
    create: { name: `Team ${coach.name}`, coachId: coach.id },
  });

  const teamUser = await upsertUser({
    name: "Voorbeeld Medewerker",
    email: "user@ceuppensconsulting.com",
    password: "Wijzig-Dit-Wachtwoord!1",
    role: Role.USER,
    teamId: team.id,
  });

  await prisma.lead.upsert({
    where: { id: "seed-lead-fa-1" },
    update: {},
    create: {
      id: "seed-lead-fa-1",
      firstName: "Jan",
      lastName: "Peeters",
      email: "jan.peeters@example.com",
      phone: "+32 470 12 34 56",
      leadType: LeadType.FA,
      source: "Website",
      stageId: faStages[0].id,
      ownerId: teamUser.id,
      createdById: coach.id,
    },
  });

  await prisma.lead.upsert({
    where: { id: "seed-lead-rg-1" },
    update: {},
    create: {
      id: "seed-lead-rg-1",
      firstName: "Sofie",
      lastName: "Willems",
      email: "sofie.willems@example.com",
      phone: "+32 471 98 76 54",
      leadType: LeadType.RG,
      source: "Doorverwijzing",
      stageId: rgStages[0].id,
      ownerId: coach.id,
      createdById: coach.id,
    },
  });

  console.log("Seed voltooid:");
  console.log(`- Beheerder: ${beheerder.email}`);
  console.log(`- Admin: ${admin.email}`);
  console.log(`- Coach: ${coach.email}`);
  console.log(`- User: ${teamUser.email}`);
  console.log("Wachtwoord voor alle voorbeeldaccounts: Wijzig-Dit-Wachtwoord!1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
