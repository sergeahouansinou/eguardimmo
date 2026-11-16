<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Data\DuplicateLeaseData;
use App\Modules\Leases\Data\NewLeaseData;
use App\Modules\Leases\Data\NewLeasePartyData;
use App\Modules\Leases\Data\NewLeaseTermData;
use App\Modules\Leases\Data\NewLeaseUnitData;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Queries\Leases;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

final readonly class DuplicateLease
{
    public function __construct(
        private Leases $baux,
        private CreateLease $creer,
    ) {}

    /**
     * Copie la structure d'un bail quelconque en nouveau brouillon : lots, parties et composantes en vigueur à la date de
     * référence (un bail terminé se lit à sa dernière journée), jamais les dates de signature ni de préavis. Lots, parties et composantes sont revérifiés comme à la création.
     */
    public function handle(Lease $source, DuplicateLeaseData $donnees): Lease
    {
        return DB::transaction(function () use ($source, $donnees): Lease {
            $bail = $this->baux->get($source->id);

            $reference = $this->referenceDate($bail);

            $lots = $this->inForce(LeaseUnit::query()->where('lease_id', $bail->id), $reference)->get();
            $parties = $this->inForce(LeaseParty::query()->where('lease_id', $bail->id), $reference)->get();
            $composantes = $this->inForce(LeaseTerm::query()->where('lease_id', $bail->id), $reference)->get();

            $locataires = $parties->where('role', LeasePartyRole::Tenant)->pluck('party_id')->all();

            return $this->creer->handle(new NewLeaseData(
                jurisdiction: $bail->jurisdiction,
                regimeKey: $bail->regime_key,
                startsOn: $donnees->startsOn,
                durationMonths: $bail->duration_months,
                tacitRenewal: $bail->tacit_renewal,
                dueDay: $bail->due_day,
                periodicity: $bail->periodicity,
                billingTiming: $bail->billing_timing,
                paymentMethod: $bail->payment_method,
                jurisdictionData: $bail->jurisdiction_data,
                customFields: $bail->custom_fields,
                note: null,
                units: array_values($lots->map(fn (LeaseUnit $ligne): NewLeaseUnitData => new NewLeaseUnitData($ligne->unit_id, $ligne->is_main))->all()),
                parties: array_values($parties->map(fn (LeaseParty $ligne): NewLeasePartyData => new NewLeasePartyData(
                    partyId: $ligne->party_id,
                    role: $ligne->role,
                    jointLiability: $ligne->joint_liability,
                    guaranteesPartyId: in_array($ligne->guarantees_party_id, $locataires, true) ? $ligne->guarantees_party_id : null,
                    guaranteeLimitAmount: $ligne->guarantee_limit_amount === null ? null : (int) $ligne->guarantee_limit_amount->getAmount(),
                    guaranteeEndsOn: $ligne->guarantee_ends_on !== null && $ligne->guarantee_ends_on->toDateString() > $donnees->startsOn ? $ligne->guarantee_ends_on->toDateString() : null,
                ))->all()),
                terms: array_values($composantes->map(fn (LeaseTerm $ligne): NewLeaseTermData => new NewLeaseTermData(
                    componentTermId: $ligne->component_term_id,
                    amount: (int) $ligne->amount->getAmount(),
                    vatBp: $ligne->vat_bp,
                    indexed: $ligne->indexed,
                ))->all()),
            ));
        });
    }

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $requete
     * @return Builder<TModel>
     */
    private function inForce(Builder $requete, string $reference): Builder
    {
        return $requete
            ->where('valid_from', '<=', $reference)
            ->where(fn (Builder $e) => $e->whereNull('valid_to')->orWhere('valid_to', '>', $reference))
            ->orderBy('valid_from')->orderBy('id');
    }

    /**
     * Jour d'aujourd'hui ramené dans la vie du bail : un bail futur se lit à son début, un bail clos à sa dernière journée.
     */
    private function referenceDate(Lease $bail): string
    {
        $jour = CarbonImmutable::today()->toDateString();
        $debut = $bail->starts_on->toDateString();

        if ($jour < $debut) {
            return $debut;
        }

        if ($bail->ends_on !== null && $jour >= $bail->ends_on->toDateString()) {
            return $bail->ends_on->toImmutable()->subDay()->toDateString();
        }

        return $jour;
    }
}
