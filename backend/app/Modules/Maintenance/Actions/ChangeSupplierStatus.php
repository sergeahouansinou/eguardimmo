<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\SupplierStatus;
use App\Modules\Maintenance\Models\SupplierProfile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class ChangeSupplierStatus
{
    /**
     * Un prestataire suspendu ou archivé ne se désigne plus ; l'historique reste. Un archivé ne se réactive pas.
     */
    public function handle(string $id, SupplierStatus $cible): SupplierProfile
    {
        return DB::transaction(function () use ($id, $cible): SupplierProfile {
            $profil = (Str::isUuid($id) ? SupplierProfile::query()->whereKey($id)->lockForUpdate()->first() : null) ?? throw ErrorCode::SupplierNotFound->problem();

            if ($profil->status === $cible) {
                return $profil;
            }

            if ($profil->status === SupplierStatus::Archived) {
                throw ErrorCode::SupplierStatusInvalid->problem();
            }

            $profil->forceFill(['status' => $cible, 'lock_version' => $profil->lock_version + 1])->save();

            return $profil;
        });
    }
}
