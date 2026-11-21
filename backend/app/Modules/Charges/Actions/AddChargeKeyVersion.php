<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\KeyKind;
use App\Modules\Charges\Models\ChargeKey;
use App\Modules\Charges\Models\ChargeKeyShare;
use App\Modules\Charges\Models\ChargeKeyVersion;
use App\Modules\Charges\Support\KeyShares;
use App\Modules\Charges\Support\Locks;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class AddChargeKeyVersion
{
    public function __construct(
        private Locks $verrous,
        private UnitDirectory $lots,
        private KeyShares $poids,
        private RecordAudit $audit,
    ) {}

    /**
     * Une version ne se réécrit jamais : la nouvelle ferme la précédente à sa date d'effet.
     *
     * @param  list<array{unit_id: string, weight: int}>  $shares
     */
    public function handle(string $propertyId, string $keyId, string $validFrom, array $shares): ChargeKey
    {
        return DB::transaction(function () use ($propertyId, $keyId, $validFrom, $shares): ChargeKey {
            $cle = ChargeKey::query()->where('property_id', $propertyId)->whereKey($keyId)->first() ?? throw ErrorCode::KeyNotFound->problem();
            $this->verrous->property($cle->property_id);
            $cle = $this->verrous->key($keyId);

            if ($cle->archived_at !== null) {
                throw ErrorCode::KeyArchived->problem();
            }

            if ($cle->kind === KeyKind::Consumption) {
                throw ErrorCode::KeyInvalid->problem('Une clé de consommation n\'a pas de version.');
            }

            $derniere = ChargeKeyVersion::query()->where('key_id', $cle->id)->orderByDesc('valid_from')->first();

            if ($derniere !== null && $validFrom <= $derniere->valid_from->toDateString()) {
                throw ErrorCode::KeyInvalid->problem('La nouvelle version doit prendre effet après la précédente.');
            }

            $poids = $this->poids->resolve($cle->kind, $this->lots->ofProperty($cle->property_id), $shares);
            $derniere?->forceFill(['valid_to' => $validFrom])->save();
            $version = ChargeKeyVersion::query()->create(['key_id' => $cle->id, 'valid_from' => $validFrom]);

            foreach ($poids as $lot => $valeur) {
                ChargeKeyShare::query()->create(['version_id' => $version->id, 'unit_id' => $lot, 'weight' => $valeur]);
            }

            $cle->forceFill(['lock_version' => $cle->lock_version + 1])->save();
            $this->audit->handle('charges.key.version_added', subject: $cle);

            return $cle->load('versions.shares');
        });
    }
}
