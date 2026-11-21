import { afterEach, describe, expect, it, vi } from "vitest";
import { depositSchema } from "@/features/assurance/depositForm";
import { noticeSchema } from "@/features/bail/noticeForm";
import { remarkFormSchema } from "@/features/etats/remarkFormSchema";
import { contactUpdatePageSchema, profileSchema } from "./accountSchemas";
import { ID, contactUpdate, inspection, insurance, noticeOptions, noticeRequest, onlinePayment, page, paymentOptions, profile, remark, submission } from "./complementsResponses.fixtures";
import { inspectionPageSchema, remarkPageSchema } from "./inspectionSchemas";
import { insuranceSchema } from "./insuranceSchemas";
import { noticeOptionsSchema, noticeRequestPageSchema } from "./noticeSchemas";
import { isLive, onlinePaymentSchema, optionsSchema, paymentHosts, safeRedirect } from "./onlinePaymentSchemas";
import { forgetPayment, paymentIdFromParams, recallPayment, rememberPayment } from "./paymentReturn";
import { PENDING_EMAIL_KEY, forgetPendingEmail, parsePendingEmail, readPendingEmail, rememberPendingEmail } from "./pendingEmail";
import { reauthHref } from "./reauth";

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.sessionStorage.clear();
});

describe("redirection vers le prestataire de paiement", () => {
  it.each(["https://pay.fake.invalid/checkout/abc", "https://checkout.stripe.com/c/pay/cs_test_1#fid"])("suit l’adresse https %s d’un hôte autorisé", (url) => {
    expect(safeRedirect(url, ["pay.fake.invalid", "checkout.stripe.com"])).toBe(new URL(url).toString());
  });

  it.each(["https://evil.example/checkout", "https://checkout.stripe.com.evil.example/x", "https://sub.checkout.stripe.com/x", "https://pay.example/x"])(
    "refuse l’hôte https non autorisé %s",
    (url) => {
      expect(safeRedirect(url, ["checkout.stripe.com"])).toBeNull();
    },
  );

  it("refuse toute adresse tant qu’aucun hôte n’est autorisé", () => {
    expect(safeRedirect("https://checkout.stripe.com/c/pay/cs_1", [])).toBeNull();
  });

  describe("liste d’hôtes issue de la configuration publique", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("reprend les hôtes configurés et ne tolère l’hôte de démonstration qu’hors production", () => {
      vi.stubEnv("NEXT_PUBLIC_PAYMENT_REDIRECT_HOSTS", " Checkout.Stripe.com , ,pay.psp.example");
      vi.stubEnv("NODE_ENV", "development");
      expect(paymentHosts()).toEqual(["checkout.stripe.com", "pay.psp.example", "pay.fake.invalid"]);
      vi.stubEnv("NODE_ENV", "production");
      expect(paymentHosts()).toEqual(["checkout.stripe.com", "pay.psp.example"]);
    });

    it("refuse en production sans configuration, y compris l’hôte de démonstration", () => {
      vi.stubEnv("NEXT_PUBLIC_PAYMENT_REDIRECT_HOSTS", "");
      vi.stubEnv("NODE_ENV", "production");
      expect(paymentHosts()).toEqual([]);
      expect(safeRedirect("https://pay.fake.invalid/checkout/abc")).toBeNull();
    });
  });

  it.each([null, "", "http://pay.example/x", "javascript:alert(1)", "data:text/html,x", "//pay.example/x", "/loyers", "pay.example/x", "https://user:pw@pay.example/x", "https://user@pay.example/x", "ftp://pay.example/x"])(
    "refuse %j",
    (url) => {
      expect(safeRedirect(url)).toBeNull();
    },
  );

  it("ne considère vivants que les statuts en attente ou en traitement", () => {
    expect(["pending", "processing", "succeeded", "failed", "cancelled", "expired"].filter((status) => isLive(status as never))).toEqual(["pending", "processing"]);
  });
});

describe("mémoire du paiement en cours", () => {
  it("retrouve l’identifiant mémorisé puis l’oublie", () => {
    rememberPayment(ID.payment);
    expect(recallPayment()).toBe(ID.payment);
    forgetPayment();
    expect(recallPayment()).toBeNull();
  });

  it("ignore une valeur mémorisée qui n’est pas un identifiant", () => {
    globalThis.sessionStorage.setItem("eguardimmo.locataire.pendingPayment", "../../me");
    expect(recallPayment()).toBeNull();
  });

  it("ne lève rien quand le stockage est inaccessible", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqué");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqué");
    });
    expect(() => { rememberPayment(ID.payment); }).not.toThrow();
    expect(recallPayment()).toBeNull();
  });

  it("lit paiement avant payment et rejette un identifiant invalide", () => {
    expect(paymentIdFromParams(new URLSearchParams(`paiement=${ID.payment}`))).toBe(ID.payment);
    expect(paymentIdFromParams(new URLSearchParams(`payment=${ID.payment}`))).toBe(ID.payment);
    expect(paymentIdFromParams(new URLSearchParams(`paiement=x&payment=${ID.payment}`))).toBe(ID.payment);
    expect(paymentIdFromParams(new URLSearchParams("paiement=x"))).toBeNull();
    expect(paymentIdFromParams(new URLSearchParams(""))).toBeNull();
  });
});

describe("changement d’e-mail en attente", () => {
  it("mémorise jusqu’à l’expiration", () => {
    rememberPendingEmail("a@b.test", 15, 1_000);
    const raw = readPendingEmail(1_000 + 14 * 60_000);
    expect(raw === null ? null : parsePendingEmail(raw)).toEqual({ email: "a@b.test", expiresAt: 1_000 + 15 * 60_000 });
    expect(readPendingEmail(1_000 + 15 * 60_000)).toBeNull();
  });

  it.each(["pas du json", JSON.stringify({ email: "pas-un-mail", expiresAt: 9e15 }), JSON.stringify({ email: "a@b.test" })])("écarte la valeur corrompue %s", (raw) => {
    globalThis.sessionStorage.setItem(PENDING_EMAIL_KEY, raw);
    expect(readPendingEmail()).toBeNull();
  });

  it("oublie sur demande", () => {
    rememberPendingEmail("a@b.test", 15);
    forgetPendingEmail();
    expect(readPendingEmail()).toBeNull();
  });

  it("ne lève rien quand le stockage est inaccessible", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqué");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqué");
    });
    expect(() => rememberPendingEmail("a@b.test", 15)).not.toThrow();
    expect(readPendingEmail()).toBeNull();
  });
});

describe("confirmation d’identité", () => {
  it("renvoie vers l’application d’authentification avec la page de retour", () => {
    const href = new URL(reauthHref("http://auth.test", "http://localhost:3002/compte/modifier") ?? "");
    expect(href.origin + href.pathname).toBe("http://auth.test/compte/securite/confirmation");
    expect(href.searchParams.get("suite")).toBe(`/continuer?return_to=${encodeURIComponent("http://localhost:3002/compte/modifier")}`);
  });

  it("ne propose rien sans adresse d’authentification", () => {
    expect(reauthHref(undefined, "http://localhost/x")).toBeNull();
    expect(reauthHref("", "http://localhost/x")).toBeNull();
  });
});

describe("réponses du serveur lues par les schémas", () => {
  it("lit chaque Resource telle que le serveur la rend", () => {
    expect(insuranceSchema.parse(insurance("valid", [submission()], "2027-10-31")).data.coverage.endsOn).toBe("2027-10-31");
    expect(noticeOptionsSchema.parse(noticeOptions()).data.reasons[1]).toMatchObject({ key: "job_loss", proofRequired: true, earliestDepartureOn: "2026-12-20" });
    expect(noticeRequestPageSchema.parse(page([noticeRequest()])).data[0]).toMatchObject({ status: "submitted", hasLetter: true, departureIsIndicative: true });
    expect(inspectionPageSchema.parse(page([inspection()])).data[0]?.openRemarkKinds).toEqual(["heating", "comment"]);
    expect(remarkPageSchema.parse(page([remark()])).data[0]?.photos).toEqual([{ id: ID.photo, position: 0 }]);
    expect(optionsSchema.parse(paymentOptions()).data.installments).toHaveLength(2);
    expect(onlinePaymentSchema.parse(onlinePayment()).data.redirectUrl).toContain("https://pay.fake.invalid/");
    expect(profileSchema.parse(profile()).data.phone).toBe("+33612345678");
    expect(contactUpdatePageSchema.parse(page([contactUpdate()])).data[0]?.status).toBe("pending");
  });

  it("écarte les moyens de paiement inconnus du client", () => {
    expect(optionsSchema.parse(paymentOptions({ methods: ["card", "crypto", "direct_debit"] })).data.methods).toEqual(["card", "direct_debit"]);
  });

  it.each([
    ["un statut de dépôt inconnu", () => insuranceSchema.safeParse(insurance("valid", [submission({ status: "archived" })]))],
    ["une couverture inconnue", () => insuranceSchema.safeParse(insurance("unknown" as never))],
    ["un statut de paiement inconnu", () => onlinePaymentSchema.safeParse(onlinePayment({ status: "paid" }))],
    ["un montant décimal", () => onlinePaymentSchema.safeParse(onlinePayment({ amount: { amount: 10.5, currency: "EUR" } }))],
    ["une nature de remarque inconnue", () => remarkPageSchema.safeParse(page([remark({ kind: "other" })]))],
    ["un identifiant qui n’est pas un uuid", () => noticeRequestPageSchema.safeParse(page([noticeRequest({ id: "1" })]))],
    ["une date mal formée", () => inspectionPageSchema.safeParse(page([inspection({ performed_on: "02/01/2026" })]))],
  ])("refuse %s", (_name, parse) => {
    expect(parse().success).toBe(false);
  });
});

describe("formulaire de dépôt d’attestation", () => {
  const today = "2026-11-20";
  const file = new File(["%PDF"], "a.pdf", { type: "application/pdf" });
  const valid = { insurer: "Mutuelle Horizon", policyNumber: "HAB-1", startsOn: "2026-11-20", endsOn: "2027-11-19", file };

  it("accepte une saisie complète", () => {
    expect(depositSchema(today).safeParse(valid).success).toBe(true);
  });

  it.each([
    ["assureur d’un caractère", { insurer: "A" }],
    ["assureur trop long", { insurer: "A".repeat(121) }],
    ["assureur avec chevron", { insurer: "<b>x</b>" }],
    ["numéro d’un caractère", { policyNumber: "1" }],
    ["numéro trop long", { policyNumber: "1".repeat(61) }],
    ["fin avant début", { endsOn: "2026-11-01" }],
    ["fin égale au début", { endsOn: "2026-11-20" }],
    ["fin déjà passée", { startsOn: "2025-01-01", endsOn: "2026-11-19" }],
    ["sans fichier", { file: null }],
    ["fichier vide", { file: new File([], "a.pdf", { type: "application/pdf" }) }],
    ["fichier exécutable", { file: new File(["x"], "a.exe", { type: "application/x-msdownload" }) }],
  ])("refuse %s", (_name, override) => {
    expect(depositSchema(today).safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it("accepte une fin de couverture à la date du jour", () => {
    expect(depositSchema(today).safeParse({ ...valid, startsOn: "2026-01-01", endsOn: "2026-11-20" }).success).toBe(true);
  });
});

describe("formulaire de congé", () => {
  const reasons = noticeOptionsSchema.parse(noticeOptions()).data.reasons;
  const valid = { reasonKey: "standard", departureOn: "2027-02-20", forwardingAddress: "", proof: null, consent: true };
  const schema = noticeSchema(reasons, "2026-11-20");

  it("accepte la date la plus proche du motif", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["sans motif", { reasonKey: "" }],
    ["départ avant la fin du préavis", { departureOn: "2027-02-19" }],
    ["départ passé", { departureOn: "2026-11-19", reasonKey: "job_loss" }],
    ["sans consentement", { consent: false }],
    ["motif exigeant un justificatif sans fichier", { reasonKey: "job_loss", departureOn: "2026-12-20" }],
    ["adresse trop longue", { forwardingAddress: "a".repeat(301) }],
    ["adresse avec caractère de contrôle", { forwardingAddress: "rue\u0000x" }],
    ["justificatif exécutable", { proof: new File(["x"], "a.exe", { type: "application/x-msdownload" }) }],
  ])("refuse %s", (_name, override) => {
    expect(schema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it("accepte le justificatif exigé", () => {
    expect(schema.safeParse({ ...valid, reasonKey: "job_loss", departureOn: "2026-12-20", proof: new File(["%PDF"], "p.pdf", { type: "application/pdf" }) }).success).toBe(true);
  });
});

describe("formulaire de remarque", () => {
  const photo = (name: string) => new File(["x"], name, { type: "image/png" });

  it.each([
    ["nature inconnue", { kind: "autre", body: "ok ok" }],
    ["texte d’un caractère", { kind: "heating", body: "a" }],
    ["texte trop long", { kind: "heating", body: "a".repeat(2001) }],
    ["sept photos", { kind: "heating", body: "ok ok", photos: Array.from({ length: 7 }, (_, index) => photo(`${String(index)}.png`)) }],
    ["photo en pdf", { kind: "heating", body: "ok ok", photos: [new File(["x"], "a.pdf", { type: "application/pdf" })] }],
  ])("refuse %s", (_name, value) => {
    expect(remarkFormSchema.safeParse({ photos: [], ...value }).success).toBe(false);
  });

  it("accepte six photos et un texte sur plusieurs lignes", () => {
    expect(remarkFormSchema.safeParse({ kind: "comment", body: "ligne 1\nligne 2", photos: Array.from({ length: 6 }, (_, index) => photo(`${String(index)}.png`)) }).success).toBe(true);
  });
});
