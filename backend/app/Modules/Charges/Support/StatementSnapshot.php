<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Jurisdictions\ChargeRules;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Models\ChargeStatementLine;
use App\Modules\Leases\Data\LeasePartyData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

/**
 * Instantané du décompte (ADR 0022, 0034 § 8) : tout ce que la pièce affiche est copié ici à l'émission, elle ne relit jamais une fiche ensuite.
 */
final readonly class StatementSnapshot
{
    public function __construct(
        private LeaseDirectory $baux,
        private LeaseParticipants $participants,
        private PartyDirectory $parties,
        private UnitDirectory $lots,
        private MembershipDirectory $adhesions,
        private OrganizationDirectory $organisation,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(ChargeStatement $decompte, ChargeExercise $exercice, ChargeRules $regles, string $numero, CarbonImmutable $date, ?string $remplace, string $reglement, ?string $pasAvant): array
    {
        $bail = $this->baux->find($decompte->lease_id);
        $debut = CarbonImmutable::parse($exercice->period_start);
        $fin = CarbonImmutable::parse($exercice->period_end);
        $locataires = array_map(fn (LeasePartyData $p): string => $p->partyId, $this->participants->tenantsAt($bail->id, max($debut, CarbonImmutable::parse($bail->startsOn))));
        $fiches = $locataires === [] ? [] : $this->parties->findMany($locataires);
        $lot = $this->lots->find($bail->units[0]->unitId);
        $lignes = ChargeStatementLine::query()->where('statement_id', $decompte->id)->orderBy('position')->get();
        $identite = $this->organisation->legalIdentity();
        $devise = $decompte->currency;

        return [
            'template_version' => $regles->templateVersion(),
            'kind' => 'charges_regularization',
            'number' => $numero,
            'issued_on' => $date->toDateString(),
            'issuer' => ['organization_id' => $this->contexte->id(), 'name' => $this->issuerName(), 'legal' => $identite === null ? null : ['legal_name' => $identite->legalName, 'address' => $identite->address, 'siren' => $identite->siren, 'vat_number' => $identite->vatNumber]],
            'lease' => ['id' => $bail->id, 'reference' => $bail->reference, 'jurisdiction' => $bail->jurisdiction, 'regime_key' => $bail->regimeKey],
            'tenants' => array_map(fn (string $id): array => ['party_id' => $id, 'name' => $fiches[$id]->displayName], $locataires),
            'unit' => ['id' => $lot->id, 'reference' => $lot->reference, 'property_name' => $lot->propertyName, 'address' => $lot->address],
            'period' => ['start' => $debut->toDateString(), 'end' => $fin->toDateString(), 'last_day' => $fin->subDay()->toDateString(), 'occupied_days' => $decompte->occupied_days],
            'currency' => $devise,
            'lines' => array_values($lignes->map(fn (ChargeStatementLine $l): array => [
                'label' => $l->label, 'rubric' => $l->rubric, 'split_label' => $l->split_label, 'item_amount' => $l->item_amount,
                'weight' => $l->weight, 'denominator' => $l->denominator, 'days' => $l->days, 'share' => $l->share,
            ])->all()),
            'totals' => [
                'share' => (int) $decompte->share_total->getAmount(), 'provisions_called' => (int) $decompte->provisions_called->getAmount(),
                'provisions_unpaid' => (int) $decompte->provisions_unpaid->getAmount(), 'balance' => (int) $decompte->balance->getAmount(),
                'suggested_monthly_provision' => (int) $decompte->suggested_monthly_provision->getAmount(),
            ],
            'settlement' => $reglement,
            'not_before' => $pasAvant,
            'supersedes_number' => $remplace,
            'rectification_reason' => $decompte->rectification_reason,
            'late' => $regles->isLate($fin, $date),
            'mentions' => $regles->mentions($date),
        ];
    }

    private function issuerName(): string
    {
        $compte = auth()->id();

        return is_string($compte) ? ($this->adhesions->activeMembership($compte, $this->contexte->id())->organizationName ?? '') : '';
    }
}
