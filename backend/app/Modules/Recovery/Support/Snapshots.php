<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use App\Modules\Accounting\Data\LeaseStatementData;
use App\Modules\Accounting\Data\StatementLineData;
use App\Modules\Leases\Data\LeaseData;
use App\Modules\Leases\Data\LeasePartyData;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\Data\PartyData;
use App\Modules\Recovery\Enums\ItemType;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryCaseItem;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Money\Money;

/**
 * Instantanés des pièces que Recovery produit (ADR 0022) : chaque pièce n'affiche que ce qui est copié ici, jamais une fiche relue.
 */
final readonly class Snapshots
{
    public const string TEMPLATE_VERSION = 'recovery-2';

    public function __construct(
        private OrganizationDirectory $organisations,
        private CurrentOrganization $organisation,
    ) {}

    public function issuerName(): string
    {
        return $this->organisations->names([$this->organisation->id()])[$this->organisation->id()] ?? '';
    }

    /**
     * @param  list<RecoveryCaseItem>  $creances
     * @param  array<string, Money>  $restes  reste dû au grand livre par créance
     * @return array<string, mixed>
     */
    public function statement(RecoveryCase $dossier, string $numeroEnvoi, LeaseData $bail, PartyData $debiteur, array $creances, array $restes, CarbonImmutable $date): array
    {
        $lignes = [];
        $appele = 0;
        $du = 0;

        foreach ($creances as $creance) {
            $reste = max(0, (int) ($restes[$creance->item_id] ?? $creance->amount_due)->getAmount());
            $total = (int) $creance->total_amount->getAmount();
            $facture = $creance->item_type === ItemType::Invoice;
            $lignes[] = [
                'type' => $creance->item_type->value,
                'item_id' => $creance->item_id,
                'reference' => $creance->reference,
                'issued_on' => $facture ? $creance->period_start->toDateString() : null,
                'period_start' => $facture ? null : $creance->period_start->toDateString(),
                'period_end' => $facture ? null : $creance->period_end->toDateString(),
                'due_date' => $creance->due_date->toDateString(),
                'total' => $total,
                'outstanding' => $reste,
            ];
            $appele += $total;
            $du += $reste;
        }

        return [
            'template_version' => self::TEMPLATE_VERSION,
            'kind' => 'recovery_statement',
            'issuer' => ['name' => $this->issuerName()],
            'case' => ['number' => $dossier->number, 'opened_on' => $dossier->opened_on->toDateString()],
            'bundle_number' => $numeroEnvoi,
            'generated_on' => $date->toDateString(),
            'currency' => $dossier->currency,
            'lease' => ['id' => $bail->id, 'reference' => $bail->reference],
            'debtor' => ['id' => $debiteur->id, 'name' => $debiteur->displayName],
            'lines' => $lignes,
            'totals' => ['called' => $appele, 'outstanding' => $du],
        ];
    }

    /**
     * @param  list<LeasePartyData>  $lignes
     * @param  array<string, PartyData>  $parties
     * @return array<string, mixed>
     */
    public function lease(RecoveryCase $dossier, LeaseData $bail, array $lignes, array $parties, CarbonImmutable $date): array
    {
        return [
            'template_version' => self::TEMPLATE_VERSION,
            'kind' => 'recovery_lease',
            'issuer' => ['name' => $this->issuerName()],
            'case' => ['number' => $dossier->number],
            'generated_on' => $date->toDateString(),
            'currency' => $bail->currency,
            'lease' => [
                'reference' => $bail->reference,
                'status' => $bail->status->value,
                'jurisdiction' => $bail->jurisdiction,
                'starts_on' => $bail->startsOn,
                'ends_on' => $bail->endsOn,
                'signed_on' => $bail->signedOn,
                'due_day' => $bail->dueDay,
                'periodicity' => $bail->periodicity->value,
                'billing_timing' => $bail->billingTiming->value,
            ],
            'parties' => array_map(fn (LeasePartyData $l): array => [
                'name' => isset($parties[$l->partyId]) ? $parties[$l->partyId]->displayName : '',
                'role' => $l->role->value,
                'joint_liability' => $l->jointLiability,
                'valid_from' => $l->validFrom,
                'valid_to' => $l->validTo,
            ], $lignes),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function ledger(RecoveryCase $dossier, LeaseData $bail, LeaseStatementData $releve, CarbonImmutable $date): array
    {
        return [
            'template_version' => self::TEMPLATE_VERSION,
            'kind' => 'recovery_ledger',
            'issuer' => ['name' => $this->issuerName()],
            'case' => ['number' => $dossier->number],
            'generated_on' => $date->toDateString(),
            'currency' => $dossier->currency,
            'lease' => ['reference' => $bail->reference],
            'from' => $releve->from->toDateString(),
            'to' => $releve->to->toDateString(),
            'opening' => (int) $releve->opening->getAmount(),
            'closing' => (int) $releve->closing->getAmount(),
            'lines' => array_map(fn (StatementLineData $l): array => [
                'date' => $l->date->toDateString(),
                'reference' => $l->reference,
                'label' => $l->label,
                'debit' => (int) $l->debit->getAmount(),
                'credit' => (int) $l->credit->getAmount(),
                'balance' => (int) $l->balance->getAmount(),
            ], $releve->lines),
        ];
    }
}
