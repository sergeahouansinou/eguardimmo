<?php

declare(strict_types=1);

namespace App\Modules\Investments\Actions;

use App\Modules\Investments\Enums\ErrorCode;
use App\Modules\Investments\Models\PropertyAcquisition;
use App\Modules\Investments\Support\Currencies;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Nouvelle version du coût de revient : la ligne est mise à jour, l'avant/après reste au journal d'activité (`Auditable`).
 */
final readonly class UpdateAcquisition
{
    public function handle(string $id, string $acquiredOn, int $price, int $costs, int $agencyFees, int $works, int $lockVersion): PropertyAcquisition
    {
        return DB::transaction(function () use ($id, $acquiredOn, $price, $costs, $agencyFees, $works, $lockVersion): PropertyAcquisition {
            $acquisition = (Str::isUuid($id) ? PropertyAcquisition::query()->whereKey($id)->lockForUpdate()->first() : null)
                ?? throw ErrorCode::AcquisitionNotFound->problem();

            if ($acquisition->lock_version !== $lockVersion) {
                throw ErrorCode::LoanVersionConflict->problem('Le coût de revient a été modifié entre-temps.');
            }

            $acquisition->forceFill([
                'acquired_on' => $acquiredOn,
                'price' => Currencies::money($price, $acquisition->currency),
                'acquisition_costs' => Currencies::money($costs, $acquisition->currency),
                'agency_fees' => Currencies::money($agencyFees, $acquisition->currency),
                'initial_works' => Currencies::money($works, $acquisition->currency),
                'lock_version' => $lockVersion + 1,
            ])->save();

            return $acquisition;
        });
    }
}
