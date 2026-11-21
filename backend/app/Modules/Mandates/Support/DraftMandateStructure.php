<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Support;

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Mandates\Data\NewMandateTermData;
use App\Modules\Mandates\Data\NewMandateUnitData;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\TermChangeReason;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use Money\Currency;
use Money\Money;

/**
 * Écrit et contrôle les lignes d'un mandat (lots, conditions) ; à appeler dans la transaction de l'Action.
 */
final readonly class DraftMandateStructure
{
    public function __construct(
        private UnitDirectory $lots,
        private PartyDirectory $parties,
        private TermDirectory $termes,
        private MandateAuthor $auteur,
    ) {}

    public function assertMandant(string $partyId): void
    {
        if ($this->parties->find($partyId)->isAnonymized) {
            throw ErrorCode::MandatePartyNotAvailable->problem();
        }
    }

    public function assertType(string $termId): void
    {
        $this->termes->findAssignable($termId, VocabularyKey::MandateType);
    }

    /**
     * @param  list<NewMandateUnitData>  $units
     */
    public function replaceUnits(Mandate $mandat, array $units): void
    {
        $this->assertUnits($mandat, $units);

        foreach (MandateUnit::query()->where('mandate_id', $mandat->id)->get() as $ligne) {
            $ligne->delete();
        }

        foreach ($units as $lot) {
            MandateUnit::query()->create([
                'mandate_id' => $mandat->id,
                'unit_id' => $lot->unitId,
                'valid_from' => $lot->validFrom ?? $mandat->starts_on->toDateString(),
            ]);
        }
    }

    /**
     * @param  list<string>  $unitIds
     */
    public function assertUnitsAvailable(array $unitIds): void
    {
        foreach ($this->lots->findMany(array_values(array_unique($unitIds))) as $lot) {
            if ($lot->isArchived) {
                throw ErrorCode::MandateUnitNotAvailable->problem();
            }
        }
    }

    public function writeTerm(Mandate $mandat, NewMandateTermData $conditions, string $from, TermChangeReason $raison, ?string $remplaceId = null): MandateTerm
    {
        $this->assertFee($conditions->feeKind, $conditions->feeBasisPoints, $conditions->feeFlatAmount);
        $devise = new Currency($mandat->currency);

        return MandateTerm::query()->create([
            'mandate_id' => $mandat->id,
            'fee_kind' => $conditions->feeKind,
            'fee_basis_points' => $conditions->feeBasisPoints,
            'fee_flat_amount' => $conditions->feeFlatAmount === null ? null : new Money($conditions->feeFlatAmount, $devise),
            'payout_day' => $conditions->payoutDay,
            'works_limit_amount' => new Money($conditions->worksLimitAmount, $devise),
            'fee_base' => $conditions->feeBase,
            'fee_minimum_amount' => new Money($conditions->feeMinimumAmount, $devise),
            'fee_tax_mode' => $conditions->feeTaxMode,
            'letting_fee_basis_points' => $conditions->lettingFeeBasisPoints,
            'works_fee_basis_points' => $conditions->worksFeeBasisPoints,
            'signed_file_id' => $conditions->signedFileId,
            'valid_from' => $from,
            'reason' => $raison,
            'replaces_id' => $remplaceId,
            'created_by_user_id' => $this->auteur->id(),
        ]);
    }

    public function assertFee(FeeKind $genre, ?int $basisPoints, ?int $forfait): void
    {
        $valide = match ($genre) {
            FeeKind::Percentage => $basisPoints !== null && $forfait === null && $basisPoints >= 0 && $basisPoints <= 10000,
            FeeKind::Flat => $forfait !== null && $basisPoints === null && $forfait >= 0,
        };

        if (! $valide) {
            throw ErrorCode::MandateFeeInvalid->problem();
        }
    }

    /**
     * Les lignes et conditions posées au premier jour du mandat le suivent quand il se décale.
     */
    public function moveStart(Mandate $mandat, string $ancienDebut): void
    {
        $nouveau = $mandat->starts_on->toDateString();

        MandateUnit::query()->where('mandate_id', $mandat->id)->where('valid_from', $ancienDebut)->get()
            ->each(fn (MandateUnit $ligne): bool => $ligne->update(['valid_from' => $nouveau]));
        MandateTerm::query()->where('mandate_id', $mandat->id)->where('valid_from', $ancienDebut)->get()
            ->each(fn (MandateTerm $terme): bool => $terme->update(['valid_from' => $nouveau]));
    }

    public function assertWithinPeriod(Mandate $mandat): void
    {
        $debut = $mandat->starts_on->toDateString();
        $fin = $mandat->ends_on->toDateString();

        $hors = MandateUnit::query()->where('mandate_id', $mandat->id)
            ->where(fn ($q) => $q->where('valid_from', '<', $debut)->orWhere('valid_from', '>=', $fin))
            ->exists();

        if ($hors) {
            throw ErrorCode::MandatePeriodInvalid->problem('Un lot commence en dehors de la période du mandat.');
        }
    }

    /**
     * @param  list<NewMandateUnitData>  $units
     */
    private function assertUnits(Mandate $mandat, array $units): void
    {
        if ($units === []) {
            throw ErrorCode::MandateNoUnit->problem();
        }

        $identifiants = array_map(fn (NewMandateUnitData $l): string => $l->unitId, $units);

        if (count(array_unique($identifiants)) !== count($identifiants)) {
            throw ErrorCode::MandateUnitConflict->problem();
        }

        foreach ($units as $lot) {
            $debut = $lot->validFrom ?? $mandat->starts_on->toDateString();

            if ($debut < $mandat->starts_on->toDateString() || $debut >= $mandat->ends_on->toDateString()) {
                throw ErrorCode::MandatePeriodInvalid->problem('Un lot commence en dehors de la période du mandat.');
            }
        }

        $this->assertUnitsAvailable($identifiants);
    }
}
