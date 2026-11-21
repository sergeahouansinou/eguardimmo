<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Leases\Data\LeasePartyData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Modules\Rent\Jurisdictions\RentDocumentRules;
use App\Modules\Rent\Jurisdictions\RentRules;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\InstallmentLine;
use App\Modules\Rent\Models\PaymentAllocation;
use Carbon\CarbonImmutable;
use Money\Money;

/**
 * Instantané d'une pièce émise (ADR 0022) : tout ce que la pièce affiche est copié ici à l'émission, et elle ne relit
 * jamais une fiche ensuite.
 */
final readonly class Snapshots
{
    public function __construct(
        private LeaseDirectory $baux,
        private LeaseParticipants $participants,
        private PartyDirectory $parties,
        private UnitDirectory $lots,
        private IssuerIdentity $emetteur,
        private RentRules $regles,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function notice(Installment $echeance, string $numero, CarbonImmutable $date): array
    {
        [$base, $regles] = $this->base($echeance);

        return [...$base, 'template_version' => $regles->templateVersion(), 'kind' => 'rent_notice', 'number' => $numero, 'issued_on' => $date->toDateString(), 'mention' => $regles->noticeMention()];
    }

    /**
     * @return array<string, mixed>
     */
    public function receipt(Installment $echeance, string $numero, CarbonImmutable $date): array
    {
        [$base, $regles] = $this->base($echeance);
        $imputations = PaymentAllocation::query()->with('payment')->where('installment_id', $echeance->id)->whereNull('reversed_at')->get();
        $payes = array_map(fn (PaymentAllocation $imputation): array => [
            'received_on' => $imputation->payment->received_on->toDateString(),
            'method' => $imputation->payment->method->value,
            'amount' => (int) $imputation->amount->getAmount(),
        ], $imputations->all());
        usort($payes, fn (array $a, array $b): int => $a['received_on'] <=> $b['received_on']);

        return [
            ...$base,
            'template_version' => $regles->templateVersion(),
            'kind' => 'rent_receipt',
            'number' => $numero,
            'issued_on' => $date->toDateString(),
            'paid_on' => $payes === [] ? $date->toDateString() : $payes[array_key_last($payes)]['received_on'],
            'payments' => $payes,
            'mention' => $regles->receiptMention(),
        ];
    }

    /**
     * @return array{0: array<string, mixed>, 1: RentDocumentRules}
     */
    private function base(Installment $echeance): array
    {
        $bail = $this->baux->find($echeance->lease_id);
        $regles = $this->regles->for($bail->jurisdiction);
        $jour = max($echeance->period_start->toDateString(), $bail->startsOn);
        $locataires = array_map(fn (LeasePartyData $p): string => $p->partyId, $this->participants->tenantsAt($echeance->lease_id, CarbonImmutable::parse($jour)));
        $locataires = $locataires === [] && $echeance->party_id !== null ? [$echeance->party_id] : $locataires;
        $fiches = $this->parties->findMany($locataires);
        $lot = $echeance->unit_id === null ? null : $this->lots->find($echeance->unit_id);

        return [[
            'issuer' => ['organization_id' => $this->emetteur->organizationId(), 'name' => $this->emetteur->name()],
            'lease' => ['id' => $bail->id, 'reference' => $bail->reference, 'jurisdiction' => $bail->jurisdiction, 'regime_key' => $bail->regimeKey],
            'tenants' => array_map(fn (string $id): array => ['party_id' => $id, 'name' => $fiches[$id]->displayName], $locataires),
            'unit' => $lot === null ? null : ['id' => $lot->id, 'reference' => $lot->reference, 'property_name' => $lot->propertyName, 'address' => $lot->address],
            'installment_id' => $echeance->id,
            'period' => ['start' => $echeance->period_start->toDateString(), 'end' => $echeance->period_end->toDateString(), 'due_date' => $echeance->due_date->toDateString()],
            'currency' => $echeance->currency,
            'lines' => array_values($echeance->lines->map(fn (InstallmentLine $ligne): array => [
                'label' => $ligne->label,
                'component_key' => $ligne->component_key,
                'semantic' => $ligne->semantic,
                'from' => $ligne->from_date->toDateString(),
                'to' => $ligne->to_date->toDateString(),
                'days' => $ligne->days,
                'month_days' => $ligne->month_days,
                'amount' => self::minor($ligne->amount),
                'vat_bp' => $ligne->vat_bp,
                'vat_amount' => self::minor($ligne->vat_amount),
            ])->all()),
            'amounts' => [
                'rent' => self::minor($echeance->rent_amount),
                'charges' => self::minor($echeance->charges_amount),
                'vat' => self::minor($echeance->vat_amount),
                'total' => self::minor($echeance->total_amount),
            ],
        ], $regles];
    }

    private static function minor(Money $montant): int
    {
        return (int) $montant->getAmount();
    }
}
