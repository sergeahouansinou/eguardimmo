<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Mandates\Data\UpdateMandateTermDefaultsData;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Models\MandateTermDefault;
use App\Modules\Mandates\Support\DraftMandateStructure;
use App\Modules\Mandates\Support\MandateAuthor;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Money\Money;

final readonly class UpdateMandateTermDefaults
{
    public function __construct(
        private DraftMandateStructure $structure,
        private OrganizationDirectory $organisation,
        private MandateAuthor $auteur,
    ) {}

    /**
     * Remplace le modèle de conditions. Aucun mandat n'est lu ni modifié : le modèle ne sert qu'à préremplir un formulaire.
     */
    public function handle(UpdateMandateTermDefaultsData $donnees): MandateTermDefault
    {
        $conditions = $donnees->terms;
        $this->structure->assertFee($conditions->feeKind, $conditions->feeBasisPoints, $conditions->feeFlatAmount);

        try {
            return DB::transaction(fn (): MandateTermDefault => $this->write($donnees));
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::MandateStaleVersion->problem();
        }
    }

    private function write(UpdateMandateTermDefaultsData $donnees): MandateTermDefault
    {
        $existant = MandateTermDefault::query()->lockForUpdate()->first();

        if ($existant === null ? $donnees->lockVersion !== null : $existant->lock_version !== $donnees->lockVersion) {
            throw ErrorCode::MandateStaleVersion->problem();
        }

        $devise = $this->organisation->currency();
        $c = $donnees->terms;
        $modele = $existant ?? new MandateTermDefault;
        $modele->fill([
            'fee_kind' => $c->feeKind,
            'fee_basis_points' => $c->feeBasisPoints,
            'fee_flat_amount' => $c->feeFlatAmount === null ? null : new Money($c->feeFlatAmount, $devise),
            'currency' => $devise->getCode(),
            'fee_base' => $c->feeBase,
            'fee_minimum_amount' => new Money($c->feeMinimumAmount, $devise),
            'fee_tax_mode' => $c->feeTaxMode,
            'payout_day' => $c->payoutDay,
            'works_limit_amount' => new Money($c->worksLimitAmount, $devise),
            'letting_fee_basis_points' => $c->lettingFeeBasisPoints,
            'works_fee_basis_points' => $c->worksFeeBasisPoints,
            'lock_version' => $existant === null ? 1 : $existant->lock_version + 1,
            'updated_by_user_id' => $this->auteur->id(),
        ])->save();

        return $modele;
    }
}
