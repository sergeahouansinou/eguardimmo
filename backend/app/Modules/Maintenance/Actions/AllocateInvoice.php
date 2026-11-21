<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Maintenance\Data\AllocationInputData;
use App\Modules\Maintenance\Enums\AllocationTarget;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\SupplierInvoiceStatus;
use App\Modules\Maintenance\Jurisdictions\ChargeRules;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InvoiceAllocation;
use App\Modules\Maintenance\Models\SupplierInvoice;
use App\Modules\Maintenance\Support\Committed;
use App\Modules\Maintenance\Support\Currencies;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Operators;
use App\Modules\Maintenance\Support\Postings;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Currency;
use Money\Money;

final readonly class AllocateInvoice
{
    public function __construct(
        private Locks $verrous,
        private Committed $engage,
        private Operators $operateurs,
        private Postings $ecritures,
        private Ledger $livre,
        private LedgerReader $soldes,
        private LeaseDirectory $baux,
        private LeaseParticipants $participants,
        private TermDirectory $termes,
        private ChargeRules $regles,
        private RecordAudit $audit,
    ) {}

    /**
     * Part de la facture imputée au propriétaire ou retenue sur le dépôt de garantie, par écriture distincte. La somme des parts
     * actives vaut exactement le TTC : à l'égalité, la facture passe `allocated`. Rejouable par clé d'idempotence.
     *
     * @return array{allocation: InvoiceAllocation, replayed: bool}
     */
    public function handle(string $interventionId, string $invoiceId, AllocationInputData $donnees): array
    {
        $empreinte = hash('sha256', (string) json_encode([$invoiceId, $donnees->target->value, $donnees->shareAmount, $donnees->wearBasisPoints, $donnees->basisNote], JSON_THROW_ON_ERROR));

        try {
            return DB::transaction(function () use ($interventionId, $invoiceId, $donnees, $empreinte): array {
                $intervention = $this->verrous->intervention($interventionId);
                $facture = $this->verrous->invoice($invoiceId, $interventionId);
                $rejeu = InvoiceAllocation::query()->where('idempotency_key', $donnees->idempotencyKey)->first();

                if ($rejeu !== null) {
                    return ['allocation' => $this->replay($rejeu, $empreinte), 'replayed' => true];
                }

                return ['allocation' => $this->allocate($intervention, $facture, $donnees, $empreinte), 'replayed' => false];
            });
        } catch (UniqueConstraintViolationException $erreur) {
            $rejeu = InvoiceAllocation::query()->where('idempotency_key', $donnees->idempotencyKey)->first() ?? throw $erreur;

            return ['allocation' => $this->replay($rejeu, $empreinte), 'replayed' => true];
        }
    }

    private function allocate(Intervention $intervention, SupplierInvoice $facture, AllocationInputData $donnees, string $empreinte): InvoiceAllocation
    {
        if ($facture->status !== SupplierInvoiceStatus::Recorded || $intervention->status->isTerminal()) {
            throw ErrorCode::InvoiceNotAllocable->problem();
        }

        $brut = (int) $facture->total_gross->getAmount();
        $engage = $this->engage->amount($intervention);

        if ($engage !== null && $this->engage->invoicedGross($intervention->id, $facture->id) > $engage) {
            throw ErrorCode::InvoiceExceedsApproval->problem();
        }

        $deja = (int) InvoiceAllocation::query()->where('supplier_invoice_id', $facture->id)->whereNull('cancelled_at')->sum('share_amount');

        if ($donnees->shareAmount <= 0 || $donnees->shareAmount > $brut - $deja) {
            throw ErrorCode::AllocationExceedsInvoice->problem();
        }

        $monnaie = Currencies::of($facture->currency);
        $part = new Money($donnees->shareAmount, $monnaie);
        $id = (string) Str::uuid7();
        $jour = CarbonImmutable::today();
        $autonome = $this->operateurs->isIndividualOrganization();
        $retenue = $part->multiply(0);
        $locataire = null;

        if ($donnees->target === AllocationTarget::Owner) {
            $ecriture = $this->ecritures->ownerAllocation($facture, $intervention, $id, $part, $autonome, $jour);
        } else {
            [$retenue, $locataire] = $this->deposit($intervention, $donnees, $part, $monnaie);
            $ecriture = $this->ecritures->depositAllocation($facture, $intervention, $id, $part, $retenue, (string) $intervention->lease_id, $locataire, $autonome, $jour);
        }

        $allocation = new InvoiceAllocation;
        $allocation->forceFill([
            'id' => $id,
            'supplier_invoice_id' => $facture->id,
            'intervention_id' => $intervention->id,
            'target' => $donnees->target,
            'party_id' => $donnees->target === AllocationTarget::Owner ? $intervention->mandant_party_id : $locataire,
            'lease_id' => $donnees->target === AllocationTarget::Deposit ? $intervention->lease_id : null,
            'share_amount' => $part,
            'wear_basis_points' => $donnees->wearBasisPoints,
            'charged_amount' => $donnees->target === AllocationTarget::Owner ? $part : $retenue,
            'currency' => $facture->currency,
            'basis_note' => $donnees->basisNote,
            'ledger_entry_id' => $this->livre->post($ecriture)->id,
            'idempotency_key' => $donnees->idempotencyKey,
            'fingerprint' => $empreinte,
            'created_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
        ])->save();

        if ($deja + $donnees->shareAmount === $brut) {
            $facture->forceFill(['status' => SupplierInvoiceStatus::Allocated, 'lock_version' => $facture->lock_version + 1])->save();
        }

        $this->audit->handle('maintenance.allocation.recorded', subject: $allocation, metadata: ['invoice_id' => $facture->id, 'target' => $donnees->target->value, 'share_amount' => $part]);

        return $allocation;
    }

    /**
     * @return array{0: Money, 1: string|null} retenue après vétusté, locataire débité
     */
    private function deposit(Intervention $intervention, AllocationInputData $donnees, Money $part, Currency $monnaie): array
    {
        if ($intervention->lease_id === null) {
            throw ErrorCode::AllocationDepositUnavailable->problem();
        }

        $bail = $this->baux->lock($intervention->lease_id);
        $regles = $this->regles->for($bail->jurisdiction);
        $nature = $this->termes->find($intervention->nature_term_id, VocabularyKey::InterventionNature);
        $regles->assertChargeable(($nature->metadata['tenant_chargeable'] ?? false) === true);

        if ($bail->status !== LeaseStatus::Terminated || $donnees->wearBasisPoints < 0 || $donnees->wearBasisPoints > 10000) {
            throw ErrorCode::AllocationDepositUnavailable->problem();
        }

        $retenue = new Money($regles->retainedAmount((int) $part->getAmount(), $donnees->wearBasisPoints), $monnaie);
        $solde = $this->soldes->depositBalance($bail->id, $monnaie);

        if ($retenue->greaterThan($solde)) {
            throw ErrorCode::AllocationDepositUnavailable->problem();
        }

        $titulaire = null;

        foreach ($this->participants->partiesOf($bail->id) as $ligne) {
            if ($ligne->role === LeasePartyRole::Tenant) {
                $titulaire = $ligne->partyId;
                break;
            }
        }

        return [$retenue, $titulaire];
    }

    private function replay(InvoiceAllocation $existante, string $empreinte): InvoiceAllocation
    {
        if (! hash_equals($existante->fingerprint, $empreinte)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $existante;
    }
}
