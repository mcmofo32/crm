import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Privacybeleid — Structuur A",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-slate-600">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <div className="flex items-center gap-3">
          <Logo size={48} />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Privacybeleid
            </h1>
            <p className="text-sm text-slate-500">
              Structuur A — CRM van Ceuppens Consulting
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-500">
          Laatst bijgewerkt: {new Date().toLocaleDateString("nl-BE", { dateStyle: "long", timeZone: "Europe/Brussels" })}
        </p>

        <Section title="Wie is verantwoordelijk">
          <p>
            Structuur A is het interne CRM van Ceuppens Consulting, gebruikt
            door de eigen medewerkers om leads en klanten op te volgen. Voor
            vragen over dit privacybeleid of over je gegevens kan je
            contact opnemen via{" "}
            <a
              href="mailto:robin@ceuppensconsulting.com"
              className="text-blue-600 underline"
            >
              robin@ceuppensconsulting.com
            </a>
            .
          </p>
        </Section>

        <Section title="Welke gegevens verzamelen we">
          <p>
            Structuur A is enkel toegankelijk voor medewerkers met een eigen
            account en wordt niet publiek aangeboden. We verwerken twee
            soorten gegevens:
          </p>
          <ul className="list-disc pl-5">
            <li>
              <strong>Accountgegevens van medewerkers</strong>: naam en
              e-mailadres (via inloggen met Google), en optioneel
              telefoonnummer, functie en profielfoto.
            </li>
            <li>
              <strong>Klant-/leadgegevens</strong>: naam, e-mailadres,
              telefoonnummer en notities die een medewerker zelf invoert
              over een lead of klant, in het kader van de eigen
              dienstverlening van Ceuppens Consulting.
            </li>
          </ul>
        </Section>

        <Section title="Gebruik van Google-gegevens">
          <p>
            Bij het inloggen met Google ontvangen we enkel je naam en
            e-mailadres, om te controleren of je een geldig CRM-account
            hebt. Koppel je daarnaast je Google Agenda (optioneel, per
            medewerker), dan gebruikt Structuur A die toegang uitsluitend
            om automatisch een agenda-item aan te maken, te wijzigen of te
            verwijderen wanneer jij zelf een afspraak of gesprek inplant in
            het CRM. We lezen je bestaande agenda-items niet uit, en delen
            deze gegevens met niemand buiten Ceuppens Consulting.
          </p>
          <p className="italic">
            Structuur A&apos;s use and transfer to any other app of
            information received from Google APIs will adhere to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-blue-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
        </Section>

        <Section title="Waarom we deze gegevens verwerken">
          <p>
            Uitsluitend om de eigen dienstverlening van Ceuppens Consulting
            te kunnen uitvoeren: leads en klanten opvolgen, afspraken
            inplannen en de eigen productie/administratie bijhouden. We
            gebruiken deze gegevens niet voor reclame, en verkopen of
            verhuren ze niet aan derden.
          </p>
        </Section>

        <Section title="Bewaring en beveiliging">
          <p>
            Gegevens worden bewaard zolang je account of klantrelatie
            actief is, en nadien zolang wettelijk vereist of relevant voor
            de eigen administratie. Toegang tot het CRM is beperkt tot
            geauthenticeerde medewerkers via hun eigen account; gevoelige
            velden (zoals agenda-koppelingen) worden versleuteld bewaard.
          </p>
        </Section>

        <Section title="Jouw rechten">
          <p>
            Ben je zelf een lead of klant van Ceuppens Consulting, dan kan
            je op elk moment vragen welke gegevens we over je bewaren, ze
            laten corrigeren, of laten verwijderen — stuur hiervoor een
            e-mail naar{" "}
            <a
              href="mailto:robin@ceuppensconsulting.com"
              className="text-blue-600 underline"
            >
              robin@ceuppensconsulting.com
            </a>
            . Een medewerker kan de koppeling met zijn Google Agenda op elk
            moment zelf loskoppelen via Instellingen in het CRM.
          </p>
        </Section>

        <p className="text-xs text-slate-400">
          <Link href="/login" className="underline hover:text-slate-600">
            Terug naar de inlogpagina
          </Link>
        </p>
      </div>
    </div>
  );
}
