"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AttendanceStatus, EventType } from "@/generated/prisma/client";
import { canManageEvents } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";

async function requireUser() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  return viewer;
}

async function requireEventManager() {
  const user = await requireUser();
  if (!canManageEvents(user)) {
    throw new Error("Je hebt geen rechten om evenementen te beheren");
  }
  return user;
}

function parseEventType(raw: FormDataEntryValue | null | undefined): EventType {
  return raw === "SEMINAR" ? "SEMINAR" : "MEETING";
}

export async function createEventAction(formData: FormData) {
  const actor = await requireEventManager();

  const title = String(formData.get("title") ?? "").trim();
  const type = parseEventType(formData.get("type"));
  const dateRaw = String(formData.get("date") ?? "");
  const timeRaw = String(formData.get("time") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!title || !dateRaw) {
    throw new Error("Titel en datum zijn verplicht");
  }

  const date = new Date(`${dateRaw}T${timeRaw || "00:00"}:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Ongeldige datum/tijd");
  }

  const event = await prisma.event.create({
    data: {
      title,
      type,
      date,
      location,
      description,
      createdById: actor.id,
    },
  });

  revalidatePath("/evenementen");
  redirect(`/evenementen/${event.id}`);
}

export async function updateEventAction(eventId: string, formData: FormData) {
  await requireEventManager();

  const title = String(formData.get("title") ?? "").trim();
  const type = parseEventType(formData.get("type"));
  const dateRaw = String(formData.get("date") ?? "");
  const timeRaw = String(formData.get("time") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!title || !dateRaw) {
    throw new Error("Titel en datum zijn verplicht");
  }

  const date = new Date(`${dateRaw}T${timeRaw || "00:00"}:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Ongeldige datum/tijd");
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { title, type, date, location, description },
  });

  revalidatePath("/evenementen");
  revalidatePath(`/evenementen/${eventId}`);
}

export async function deleteEventAction(eventId: string) {
  await requireEventManager();
  await prisma.event.delete({ where: { id: eventId } });
  revalidatePath("/evenementen");
  redirect("/evenementen");
}

function parseAttendanceStatus(raw: FormDataEntryValue | null): AttendanceStatus {
  return raw === "GOING" ? "GOING" : raw === "NOT_GOING" ? "NOT_GOING" : "PENDING";
}

/** De ingelogde gebruiker geeft aan of die aanwezig zal zijn. */
export async function setMyAttendanceAction(
  eventId: string,
  formData: FormData
) {
  const user = await requireUser();
  const status = parseAttendanceStatus(formData.get("status"));

  await prisma.eventAttendance.upsert({
    where: { eventId_userId: { eventId, userId: user.id } },
    create: { eventId, userId: user.id, status },
    update: { status },
  });

  revalidatePath("/evenementen");
  revalidatePath(`/evenementen/${eventId}`);
  revalidatePath("/dashboard");
}

export type EventWithMyStatus = {
  id: string;
  title: string;
  type: EventType;
  date: Date;
  location: string | null;
  description: string | null;
  myStatus: AttendanceStatus;
  goingCount: number;
};

export async function getEventsForCurrentUser(): Promise<EventWithMyStatus[]> {
  const user = await requireUser();

  const events = await prisma.event.findMany({
    orderBy: { date: "asc" },
    include: {
      attendances: {
        select: { userId: true, status: true },
      },
    },
  });

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    type: event.type,
    date: event.date,
    location: event.location,
    description: event.description,
    myStatus:
      event.attendances.find((a) => a.userId === user.id)?.status ?? "PENDING",
    goingCount: event.attendances.filter((a) => a.status === "GOING").length,
  }));
}

export async function getEventForDetail(eventId: string) {
  const user = await requireUser();
  const canManage = canManageEvents(user);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      attendances: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!event) return null;

  const myStatus =
    event.attendances.find((a) => a.userId === user.id)?.status ?? "PENDING";

  return {
    id: event.id,
    title: event.title,
    type: event.type,
    date: event.date,
    location: event.location,
    description: event.description,
    createdById: event.createdById,
    myStatus,
    canManage,
    attendances: canManage
      ? event.attendances.map((a) => ({
          userId: a.userId,
          name: a.user.name,
          status: a.status,
        }))
      : [],
  };
}

/**
 * Percentage seminaries dit jaar waarop de gebruiker aangeeft aanwezig te
 * (zullen) zijn — vormt KPI Seminarie op het dashboard.
 */
export async function getSeminarAttendancePercent(
  userId: string,
  year: number
): Promise<{ actual: number; total: number; percent: number | null }> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const seminars = await prisma.event.findMany({
    where: { type: "SEMINAR", date: { gte: start, lt: end } },
    select: {
      id: true,
      attendances: { where: { userId }, select: { status: true } },
    },
  });

  const total = seminars.length;
  const going = seminars.filter(
    (s) => s.attendances[0]?.status === "GOING"
  ).length;

  return {
    actual: going,
    total,
    percent: total > 0 ? Math.round((going / total) * 100) : null,
  };
}
