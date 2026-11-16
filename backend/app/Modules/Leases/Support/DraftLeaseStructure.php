<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\ErrorCode as CatalogErrorCode;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Leases\Data\NewLeasePartyData;
use App\Modules\Leases\Data\NewLeaseTermData;
use App\Modules\Leases\Data\NewLeaseUnitData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\TermChangeReason;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Shared\Http\ApiProblem;
use Illuminate\Validation\ValidationException;
use Money\Money;

/**
 * Écrit les lignes d'un brouillon (lots, parties, composantes initiales) ; à appeler dans la transaction de l'Action.
 */
final readonly class DraftLeaseStructure
{
    public function __construct(
        private UnitDirectory $lots,
        private PartyDirectory $parties,
        private TermDirectory $termes,
        private DraftAuthor $auteur,
    ) {}

    /**
     * @param  list<NewLeaseUnitData>  $units
     */
    public function replaceUnits(Lease $bail, array $units): void
    {
        $this->assertUnits($units);

        foreach (LeaseUnit::query()->where('lease_id', $bail->id)->get() as $ligne) {
            $ligne->delete();
        }

        foreach ($units as $lot) {
            LeaseUnit::query()->create([
                'lease_id' => $bail->id,
                'unit_id' => $lot->unitId,
                'is_main' => $lot->isMain,
                'valid_from' => $bail->starts_on->toDateString(),
            ]);
        }
    }

    /**
     * @param  list<NewLeasePartyData>  $parties
     */
    public function replaceParties(Lease $bail, array $parties): void
    {
        $this->assertParties($bail, $parties);

        foreach (LeaseParty::query()->where('lease_id', $bail->id)->get() as $ligne) {
            $ligne->delete();
        }

        foreach ($parties as $partie) {
            LeaseParty::query()->create([
                'lease_id' => $bail->id,
                'party_id' => $partie->partyId,
                'role' => $partie->role,
                'joint_liability' => $partie->jointLiability,
                'guarantees_party_id' => $partie->guaranteesPartyId,
                'guarantee_limit_amount' => $partie->guaranteeLimitAmount === null ? null : new Money($partie->guaranteeLimitAmount, DraftCurrency::of($bail)),
                'guarantee_ends_on' => $partie->guaranteeEndsOn,
                'valid_from' => $bail->starts_on->toDateString(),
            ]);
        }
    }

    /**
     * @param  list<NewLeaseTermData>  $terms
     */
    public function replaceTerms(Lease $bail, array $terms): void
    {
        $this->assertTerms($terms);

        foreach (LeaseTerm::query()->where('lease_id', $bail->id)->get() as $ligne) {
            $ligne->delete();
        }

        $auteur = $this->auteur->id();

        foreach ($terms as $terme) {
            LeaseTerm::query()->create([
                'lease_id' => $bail->id,
                'component_term_id' => $terme->componentTermId,
                'amount' => new Money($terme->amount, DraftCurrency::of($bail)),
                'vat_bp' => $terme->vatBp,
                'indexed' => $terme->indexed,
                'valid_from' => $terme->validFrom ?? $bail->starts_on->toDateString(),
                'reason' => TermChangeReason::Initial,
                'created_by_user_id' => $auteur,
            ]);
        }
    }

    /**
     * Les lignes ouvertes au début du bail suivent un déplacement de ce début.
     */
    public function moveStart(Lease $bail, string $ancienDebut): void
    {
        $nouveau = $bail->starts_on->toDateString();

        foreach ([LeaseUnit::class, LeaseParty::class, LeaseTerm::class] as $modele) {
            foreach ($modele::query()->where('lease_id', $bail->id)->where('valid_from', $ancienDebut)->get() as $ligne) {
                $ligne->setAttribute('valid_from', $nouveau);
                $ligne->save();
            }
        }
    }

    /**
     * @param  list<NewLeaseUnitData>  $units
     */
    private function assertUnits(array $units): void
    {
        $ids = array_map(fn (NewLeaseUnitData $lot): string => $lot->unitId, $units);

        if ($units === []) {
            throw ErrorCode::LeaseNoMainUnit->problem();
        }

        if (count(array_unique($ids)) !== count($ids)) {
            throw ErrorCode::LeaseUnitConflict->problem();
        }

        $principaux = count(array_filter($units, fn (NewLeaseUnitData $lot): bool => $lot->isMain));

        if ($principaux === 0) {
            throw ErrorCode::LeaseNoMainUnit->problem();
        }

        if ($principaux > 1) {
            throw ErrorCode::LeaseMainUnitConflict->problem();
        }

        foreach ($this->lots->findMany($ids) as $lot) {
            if ($lot->isArchived) {
                throw ErrorCode::LeaseUnitNotAvailable->problem();
            }
        }
    }

    /**
     * @param  list<NewLeasePartyData>  $parties
     */
    private function assertParties(Lease $bail, array $parties): void
    {
        $vues = [];
        $locataires = [];
        $existantes = $this->parties->findMany(array_values(array_unique(array_map(fn (NewLeasePartyData $p): string => $p->partyId, $parties))));

        foreach ($parties as $rang => $partie) {
            $cle = $partie->partyId.'|'.$partie->role->value;

            if (isset($vues[$cle])) {
                throw ErrorCode::LeasePartyConflict->problem();
            }

            $vues[$cle] = true;

            if ($partie->role === LeasePartyRole::Tenant) {
                $locataires[$partie->partyId] = true;
            }

            if ($existantes[$partie->partyId]->isAnonymized) {
                throw ErrorCode::LeasePartyNotAvailable->problem();
            }

            $this->assertGuarantee($bail, $partie, $rang);
        }

        foreach ($parties as $partie) {
            if ($partie->guaranteesPartyId !== null && ! isset($locataires[$partie->guaranteesPartyId])) {
                throw ErrorCode::LeasePartyNotFound->problem();
            }
        }
    }

    private function assertGuarantee(Lease $bail, NewLeasePartyData $partie, int $rang): void
    {
        $garantie = $partie->guaranteesPartyId !== null || $partie->guaranteeLimitAmount !== null || $partie->guaranteeEndsOn !== null;

        if ($garantie && $partie->role !== LeasePartyRole::Guarantor) {
            throw ValidationException::withMessages(["parties.{$rang}.role" => ['Seul un garant porte une caution.']]);
        }

        if ($partie->guaranteeLimitAmount !== null && $partie->guaranteeLimitAmount < 1) {
            throw ValidationException::withMessages(["parties.{$rang}.guarantee_limit_amount" => ['Le plafond de la caution doit être positif.']]);
        }

        if ($partie->guaranteeEndsOn !== null && $partie->guaranteeEndsOn <= $bail->starts_on->toDateString()) {
            throw ErrorCode::LeasePeriodInvalid->problem();
        }
    }

    /**
     * @param  list<NewLeaseTermData>  $terms
     */
    private function assertTerms(array $terms): void
    {
        $composantes = [];
        $referentiel = $this->composantes($terms);

        foreach ($terms as $rang => $terme) {
            if (isset($composantes[$terme->componentTermId])) {
                throw ErrorCode::LeaseTermOverlap->problem();
            }

            $composantes[$terme->componentTermId] = true;

            if ($terme->amount < 0) {
                throw ValidationException::withMessages(["terms.{$rang}.amount" => ['Le montant ne peut pas être négatif.']]);
            }

            if ($terme->vatBp < 0 || $terme->vatBp > 10000) {
                throw ValidationException::withMessages(["terms.{$rang}.vat_bp" => ['Le taux de TVA doit être compris entre 0 et 10000 points de base.']]);
            }

            if ($referentiel[$terme->componentTermId]->isArchived || $referentiel[$terme->componentTermId]->isHidden) {
                throw ErrorCode::LeaseComponentInvalid->problem();
            }
        }
    }

    /**
     * @param  list<NewLeaseTermData>  $terms
     * @return array<string, TermData>
     */
    private function composantes(array $terms): array
    {
        try {
            return $this->termes->findMany(array_values(array_unique(array_map(fn (NewLeaseTermData $t): string => $t->componentTermId, $terms))), VocabularyKey::LeaseComponent);
        } catch (ApiProblem $probleme) {
            throw $probleme->problemCode === CatalogErrorCode::TermNotFound->value ? ErrorCode::LeaseComponentInvalid->problem() : $probleme;
        }
    }
}
