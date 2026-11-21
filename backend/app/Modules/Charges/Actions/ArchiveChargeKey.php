<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Models\ChargeKey;
use App\Modules\Charges\Support\Locks;
use Illuminate\Support\Facades\DB;

final readonly class ArchiveChargeKey
{
    public function __construct(private Locks $verrous) {}

    /**
     * Une clé archivée ne sert plus à de nouveaux postes ; les exercices déjà calculés la gardent. Rejouable.
     */
    public function handle(string $propertyId, string $keyId): ChargeKey
    {
        return DB::transaction(function () use ($propertyId, $keyId): ChargeKey {
            $cle = ChargeKey::query()->where('property_id', $propertyId)->whereKey($keyId)->first() ?? throw ErrorCode::KeyNotFound->problem();
            $this->verrous->property($cle->property_id);
            $cle = $this->verrous->key($keyId);

            if ($cle->archived_at === null) {
                $cle->forceFill(['archived_at' => now(), 'lock_version' => $cle->lock_version + 1])->save();
            }

            return $cle->load('versions.shares');
        });
    }
}
