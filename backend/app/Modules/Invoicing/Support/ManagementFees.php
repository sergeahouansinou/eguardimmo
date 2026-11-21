<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Catalog\Enums\InvoiceItemSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Invoicing\Actions\CreateDraft;
use App\Modules\Invoicing\Actions\IssueCreditNote;
use App\Modules\Invoicing\Actions\IssueInvoice;
use App\Modules\Invoicing\Actions\RecordInvoicePayment;
use App\Modules\Invoicing\Data\CreditLineData;
use App\Modules\Invoicing\Data\CreditNoteData;
use App\Modules\Invoicing\Data\DraftData;
use App\Modules\Invoicing\Data\FeeCreditData;
use App\Modules\Invoicing\Data\FeeInvoiceData;
use App\Modules\Invoicing\Data\FeeInvoiceRequestData;
use App\Modules\Invoicing\Data\NewLineData;
use App\Modules\Invoicing\Data\NewPaymentData;
use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Enums\PaymentMethod;
use App\Modules\Invoicing\Enums\TaxCategory;
use App\Modules\Invoicing\Jurisdictions\InvoiceRules;
use App\Modules\Invoicing\Jurisdictions\InvoiceTaxRules;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Organizations\Enums\VatRegime;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Factures d'honoraires de gestion générées par le serveur pour OwnerFunds (ADR 0031, décision 3) : émission, compensation
 * sur le compte du mandant et avoir. Suppose un contexte d'organisation ; chaque appel s'exécute dans la transaction de
 * l'appelant, qui a déjà pris le verrou du compte mandant.
 */
final readonly class ManagementFees
{
    public function __construct(
        private CreateDraft $brouillons,
        private IssueInvoice $emission,
        private RecordInvoicePayment $reglements,
        private IssueCreditNote $avoirs,
        private InvoiceRules $juridictions,
        private OrganizationDirectory $organisations,
        private TermDirectory $termes,
        private Locks $verrous,
        private Statuses $statuts,
        private CreditedTotals $credites,
    ) {}

    /**
     * Taux de TVA des honoraires de gestion à la date (cent-millièmes, 100 000 = 100 %) ; 0 en franchise.
     */
    public function vatRatePcm(CarbonImmutable $date): int
    {
        $regles = $this->rules();
        $identite = $this->organisations->legalIdentity();
        $regime = $identite === null ? VatRegime::Normal : $identite->vatRegime;
        $categorie = $regles->effectiveCategory($regime, TaxCategory::Standard);

        return $regles->rate($categorie, $regime === VatRegime::Franchise ? null : $regles->managementFeeRateKey(), $date)->ratePcm;
    }

    /**
     * Brouillon puis émission de la facture du relevé, ou la facture déjà émise (rejeu).
     */
    public function issue(FeeInvoiceRequestData $demande, CarbonImmutable $today): FeeInvoiceData
    {
        return DB::transaction(function () use ($demande, $today): FeeInvoiceData {
            $existante = Invoice::query()->where('fee_statement_id', $demande->statementId)->lockForUpdate()->first();

            if ($existante !== null && $existante->status->isEmitted()) {
                return $this->data($existante, true);
            }

            $facture = $existante ?? $this->brouillons->handle($this->draft($demande, $today), $today)['invoice'];
            $emise = $this->emission->handle($facture->id, $today)['invoice'];

            return $this->data($emise, false);
        });
    }

    /**
     * Règle la facture sur le compte du mandant, à hauteur de min(reste dû, `$maxMinor`) ; retourne le montant compensé.
     */
    public function settleFromOwnerAccount(string $invoiceId, int $maxMinor, string $idempotencyKey, CarbonImmutable $today): int
    {
        return DB::transaction(function () use ($invoiceId, $maxMinor, $idempotencyKey, $today): int {
            $facture = $this->verrous->invoice($invoiceId);

            if ($facture->kind !== InvoiceKind::Invoice || $facture->fee_statement_id === null || ! in_array($facture->status, [InvoiceStatus::Issued, InvoiceStatus::PartiallyPaid], true)) {
                return 0;
            }

            $montant = min($maxMinor, (int) $this->statuts->outstanding($facture)->getAmount());

            if ($montant <= 0) {
                return 0;
            }

            $date = max($today->toDateString(), $facture->issued_on?->toDateString() ?? $today->toDateString());
            $this->reglements->handle($facture->id, new NewPaymentData($montant, PaymentMethod::OwnerAccount, $date, null, $idempotencyKey), $today);

            return $montant;
        });
    }

    /**
     * Reste dû en TTC d'une facture d'honoraires émise (0 si elle n'existe pas ou n'est plus due).
     */
    public function outstanding(string $invoiceId): int
    {
        $facture = Invoice::query()->whereKey($invoiceId)->whereNotNull('fee_statement_id')->first();

        return $facture === null || ! in_array($facture->status, [InvoiceStatus::Issued, InvoiceStatus::PartiallyPaid], true)
            ? 0
            : max(0, (int) $this->statuts->outstanding($facture)->getAmount());
    }

    /**
     * Avoir d'au plus `$netMinor` hors taxe sur la dernière facture d'honoraires du mandat, dans la limite de ce qui reste
     * créditable. Retourne null quand rien ne se crédite : le montant est alors à reporter.
     */
    public function creditLatest(string $mandateId, int $netMinor, string $idempotencyKey, string $reason, CarbonImmutable $today): ?FeeCreditData
    {
        return DB::transaction(function () use ($mandateId, $netMinor, $idempotencyKey, $reason, $today): ?FeeCreditData {
            $origine = Invoice::query()
                ->where('mandate_id', $mandateId)->whereNotNull('fee_statement_id')->where('kind', InvoiceKind::Invoice->value)
                ->whereIn('status', [InvoiceStatus::Issued->value, InvoiceStatus::PartiallyPaid->value, InvoiceStatus::Paid->value])
                ->orderByDesc('issued_on')->orderByDesc('number')->first();

            if ($origine === null || $netMinor <= 0) {
                return null;
            }

            $origine = $this->verrous->invoice($origine->id);
            $ligne = $origine->lines()->first();

            if ($ligne === null) {
                return null;
            }

            $credites = $this->credites->of($origine->id);
            $net = $this->creditableNet($ligne->unit_price, $ligne->quantity_milli, $ligne->net_amount - ($credites['nets'][$ligne->id] ?? 0), $ligne->quantity_milli - ($credites['quantities'][$ligne->id] ?? 0), $netMinor);

            if ($net[0] <= 0) {
                return null;
            }

            $resteAvant = (int) $this->statuts->outstanding($origine)->getAmount();
            $demande = new CreditNoteData($reason, false, [new CreditLineData($ligne->id, $net[1])], $idempotencyKey);
            $avoir = $this->avoirs->handle($origine->id, $demande, $today, true)['invoice'];

            return new FeeCreditData(
                $avoir->id,
                (string) $avoir->number,
                $origine->id,
                (int) $avoir->total_net->getAmount(),
                (int) $avoir->total_gross->getAmount(),
                min(max(0, (int) $avoir->total_gross->getAmount() - $resteAvant), $this->compensatedTotal($origine)),
            );
        });
    }

    /**
     * @return array{0: int, 1: int} net crédité et quantité (millièmes) : jamais plus que demandé, jamais plus que créditable
     */
    private function creditableNet(int $prixUnitaire, int $quantiteFacturee, int $netRestant, int $quantiteRestante, int $demande): array
    {
        if ($prixUnitaire <= 0 || $quantiteRestante <= 0 || $netRestant <= 0) {
            return [0, 0];
        }

        if ($demande >= $netRestant) {
            return [$netRestant, $quantiteRestante];
        }

        $quantite = min($quantiteRestante, intdiv($demande * 1000, $prixUnitaire));

        while ($quantite > 0 && intdiv($prixUnitaire * $quantite + 500, 1000) > $demande) {
            $quantite--;
        }

        return [$quantite > 0 ? intdiv($prixUnitaire * $quantite + 500, 1000) : 0, $quantite];
    }

    private function compensatedTotal(Invoice $facture): int
    {
        return (int) $facture->payments()->reorder()->where('method', PaymentMethod::OwnerAccount->value)->whereNull('cancelled_at')->sum('amount');
    }

    private function draft(FeeInvoiceRequestData $demande, CarbonImmutable $today): DraftData
    {
        $terme = null;

        foreach ($this->termes->bySemanticKey(VocabularyKey::InvoiceItem, InvoiceItemSemantic::FeeManagement->value) as $candidat) {
            if (! $candidat->isArchived && ! $candidat->isHidden) {
                $terme = $candidat;
                break;
            }
        }

        if ($terme === null || $demande->netMinor <= 0) {
            throw ErrorCode::LinesInvalid->problem();
        }

        $ligne = new NewLineData($terme->id, $demande->description, 1000, $demande->netMinor, TaxCategory::Standard, $this->rules()->managementFeeRateKey());

        return new DraftData(
            $demande->mandantPartyId,
            null,
            $demande->mandateId,
            $today->toDateString(),
            $demande->periodStart->toDateString(),
            $demande->periodEnd->toDateString(),
            [$ligne],
            'owner_funds:fee:'.$demande->statementId,
            null,
            $demande->statementId,
        );
    }

    private function data(Invoice $facture, bool $rejeu): FeeInvoiceData
    {
        return new FeeInvoiceData(
            $facture->id,
            (string) $facture->number,
            (int) $facture->total_net->getAmount(),
            (int) $facture->total_tax->getAmount(),
            (int) $facture->total_gross->getAmount(),
            max(0, (int) $this->statuts->outstanding($facture)->getAmount()),
            $rejeu,
        );
    }

    private function rules(): InvoiceTaxRules
    {
        return $this->juridictions->for($this->organisations->country());
    }
}
