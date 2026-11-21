<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Data\SupplierInputData;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Models\SupplierProfile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class UpdateSupplier
{
    public function __construct(private CreateSupplier $creation) {}

    public function handle(string $id, SupplierInputData $donnees): SupplierProfile
    {
        return DB::transaction(function () use ($id, $donnees): SupplierProfile {
            $profil = (Str::isUuid($id) ? SupplierProfile::query()->whereKey($id)->lockForUpdate()->first() : null) ?? throw ErrorCode::SupplierNotFound->problem();
            $profil->forceFill([
                'preferred' => $donnees->preferred,
                'payment_terms_days' => $donnees->paymentTermsDays,
                'internal_note' => $donnees->internalNote,
                'custom_fields' => $donnees->customFields,
                'lock_version' => $profil->lock_version + 1,
            ])->save();
            $this->creation->syncTrades($profil, $donnees->tradeTermIds);

            return $profil;
        });
    }
}
