import { describe, expect, it } from "vitest";
import { createDemoData, DEMO_TODAY } from "./demo";
import { createConfieStore, ConfieError } from "./store";
import { confieSchema } from "./schemas";
import { deriveCounts, deriveNotifications, pendingQuotes } from "./derive";

const INTERVENTION = "fuite-sous-l-evier";
const store = () => createConfieStore(createDemoData());
const intervention = (s: ReturnType<typeof store>) => {
  const found = s.snapshot().interventions.find((item) => item.id === INTERVENTION);
  if (!found) throw new Error("fixture absente");
  return found;
};

describe("données de démonstration", () => {
  it("respectent le schéma", () => {
    expect(() => confieSchema.parse(createDemoData())).not.toThrow();
    expect(createDemoData().today).toBe(DEMO_TODAY);
  });

  it("les totaux du compte rendu T3 égalent la somme des reversements de juillet à septembre", () => {
    const data = createDemoData();
    const report = data.reports.find((item) => item.id === "t3-2026");
    expect(report).toBeDefined();
    const monthly = data.settlements.filter((item) => ["2026-07", "2026-08", "2026-09"].includes(item.month));
    expect(monthly).toHaveLength(3);
    const collected = monthly.reduce((total, item) => total + item.lines.reduce((sub, line) => sub + line.collected, 0), 0);
    const reportCollected = (report?.months ?? []).reduce((total, month) => total + month.collected, 0);
    expect(reportCollected).toBe(collected);
  });
});

describe("décision sur un devis", () => {
  it("accepter applique la décision à la fixture et solde la validation en attente", () => {
    const s = store();
    expect(pendingQuotes(s.snapshot())).toHaveLength(1);
    s.decideQuote({ interventionId: INTERVENTION, decision: "accept", comment: "" });
    const after = intervention(s);
    expect(after.status).toBe("quote_accepted");
    expect(after.decision?.kind).toBe("accept");
    expect(after.timeline.at(-1)?.title).toBe("Devis accepté par vous");
    expect(pendingQuotes(s.snapshot())).toHaveLength(0);
    expect(deriveCounts(s.snapshot()).interventions).toBe(0);
  });

  it("refuser exige un motif et le consigne", () => {
    const s = store();
    expect(() => { s.decideQuote({ interventionId: INTERVENTION, decision: "refuse", comment: "" }); }).toThrow(ConfieError);
    expect(intervention(s).status).toBe("quote_pending");
    s.decideQuote({ interventionId: INTERVENTION, decision: "refuse", comment: "Trop cher, un second devis svp" });
    expect(intervention(s).status).toBe("quote_refused");
    expect(intervention(s).timeline.at(-1)?.detail).toContain("Trop cher");
  });

  it("une demande de précision laisse le devis en attente", () => {
    const s = store();
    s.decideQuote({ interventionId: INTERVENTION, decision: "precision", comment: "Le joint est-il compris ?" });
    expect(intervention(s).status).toBe("quote_pending");
    expect(intervention(s).decision?.kind).toBe("precision");
  });

  it("refuse une intervention inconnue ou un devis déjà tranché", () => {
    const s = store();
    expect(() => { s.decideQuote({ interventionId: "inconnue", decision: "accept", comment: "" }); }).toThrow("introuvable");
    s.decideQuote({ interventionId: INTERVENTION, decision: "accept", comment: "" });
    expect(() => { s.decideQuote({ interventionId: INTERVENTION, decision: "accept", comment: "" }); }).toThrow("n'attend plus");
  });
});

describe("fin de mandat", () => {
  it("enregistre une demande à l'échéance puis permet de l'annuler", () => {
    const s = store();
    s.requestMandateEnd({ kind: "at_term", desiredOn: "", reason: "", details: "" });
    expect(s.snapshot().mandate.endRequest).toMatchObject({ kind: "at_term", desiredOn: null, requestedOn: DEMO_TODAY });
    expect(() => { s.requestMandateEnd({ kind: "at_term", desiredOn: "", reason: "", details: "" }); }).toThrow("déjà en cours");
    s.cancelMandateEnd();
    expect(s.snapshot().mandate.endRequest).toBeNull();
    expect(() => { s.cancelMandateEnd(); }).toThrow("Aucune demande");
  });

  it("refuse une fin anticipée qui ne respecte pas le préavis de 3 mois", () => {
    const s = store();
    const early = { kind: "early", reason: "vente", details: "" } as const;
    expect(() => { s.requestMandateEnd({ ...early, desiredOn: "2027-01-01" }); }).toThrow("préavis");
    s.requestMandateEnd({ ...early, desiredOn: "2027-02-13" });
    expect(s.snapshot().mandate.endRequest).toMatchObject({ kind: "early", desiredOn: "2027-02-13", reason: "vente" });
  });

  it("exige motif et date pour une fin anticipée", () => {
    const s = store();
    expect(() => { s.requestMandateEnd({ kind: "early", desiredOn: "", reason: "vente", details: "" }); }).toThrow("date");
    expect(() => { s.requestMandateEnd({ kind: "early", desiredOn: "2027-03-01", reason: "", details: "" }); }).toThrow("motif");
  });
});

describe("profil et IBAN", () => {
  const valid = { representative: "Marc Chevalier", street: "5 chemin des Vignes", postalCode: "69300", city: "Caluire-et-Cuire", phone: "+33 6 00 00 00 09", email: "marc@example.com" };

  it("met à jour les coordonnées et rejette une saisie invalide sans rien modifier", () => {
    const s = store();
    s.updateProfile({ ...valid, city: "Lyon" });
    expect(s.snapshot().profile.city).toBe("Lyon");
    expect(() => { s.updateProfile({ ...valid, postalCode: "69" }); }).toThrow("5 chiffres");
    expect(s.snapshot().profile.postalCode).toBe("69300");
    expect(s.snapshot().profile.denomination).toBe("SCI Chevalier");
  });

  it("garde un changement d'IBAN en attente sans toucher à l'IBAN actif", () => {
    const s = store();
    s.requestIbanChange({ iban: "FR76 3000 6000 0112 3456 7890 189" });
    expect(s.snapshot().profile.pendingIbanChange).toEqual({ ibanLast4: "0189", requestedOn: DEMO_TODAY });
    expect(s.snapshot().profile.payout.ibanLast4).toBe("0482");
    expect(() => { s.requestIbanChange({ iban: "FR76 3000 6000 0112 3456 7890 188" }); }).toThrow("IBAN invalide");
  });
});

describe("documents", () => {
  const input = { title: "Bail Studio 4", category: "mandat", lotId: "studio-4", fileType: "application/pdf", fileName: "bail.pdf", sizeKo: 320 };

  it("ajoute le document en tête avec un identifiant unique", () => {
    const s = store();
    const before = s.snapshot().documents.length;
    s.addDocument(input);
    s.addDocument(input);
    const documents = s.snapshot().documents;
    expect(documents).toHaveLength(before + 2);
    expect(documents.slice(0, 2).map((item) => item.id)).toEqual(["depose-bail-studio-4-2", "depose-bail-studio-4"]);
    expect(documents[0]?.lotIds).toEqual(["studio-4"]);
  });

  it("refuse un format, une taille ou un lot invalides", () => {
    const s = store();
    expect(() => { s.addDocument({ ...input, fileType: "application/zip" }); }).toThrow("Format");
    expect(() => { s.addDocument({ ...input, sizeKo: 20_000 }); }).toThrow("10 Mo");
    expect(() => { s.addDocument({ ...input, lotId: "inconnu" }); }).toThrow("Lot inconnu");
  });
});

describe("préférences, comptes rendus et notifications", () => {
  it("enregistre les canaux choisis et refuse une préférence inconnue", () => {
    const s = store();
    s.savePreferences([{ id: "impaye", email: false, push: true }]);
    expect(s.snapshot().preferences.find((item) => item.id === "impaye")).toMatchObject({ email: false, push: true });
    expect(s.snapshot().preferences.find((item) => item.id === "devis")).toMatchObject({ email: true, push: true });
    expect(() => { s.savePreferences([{ id: "x", email: true, push: true }]); }).toThrow("inconnue");
  });

  it("marquer un compte rendu comme consulté fait baisser le compteur", () => {
    const s = store();
    const before = deriveCounts(s.snapshot())["comptes-rendus"];
    expect(before).toBe(1);
    s.markReportViewed("t3-2026");
    expect(deriveCounts(s.snapshot())["comptes-rendus"]).toBe(0);
    expect(() => { s.markReportViewed("inconnu"); }).toThrow("introuvable");
  });

  it("tout marquer comme lu vide les notifications non lues", () => {
    const s = store();
    expect(deriveNotifications(s.snapshot()).some((item) => item.unread)).toBe(true);
    s.markAllNotificationsRead();
    expect(deriveNotifications(s.snapshot()).every((item) => !item.unread)).toBe(true);
  });

  it("marque une notification comme lue sans toucher aux autres, et refuse un identifiant inconnu", () => {
    const s = store();
    const unread = deriveNotifications(s.snapshot()).filter((item) => item.unread);
    const [first] = unread;
    if (!first) throw new Error("aucune notification non lue");
    s.markNotificationRead(first.id);
    const after = deriveNotifications(s.snapshot());
    expect(after.find((item) => item.id === first.id)?.unread).toBe(false);
    expect(after.filter((item) => item.unread)).toHaveLength(unread.length - 1);
    s.markNotificationRead(first.id);
    expect(() => { s.markNotificationRead("inconnue"); }).toThrow("introuvable");
  });

  it("le snapshot est une copie isolée de l'état", () => {
    const s = store();
    const copy = s.snapshot();
    copy.profile.city = "Paris";
    expect(s.snapshot().profile.city).toBe("Caluire-et-Cuire");
  });
});
