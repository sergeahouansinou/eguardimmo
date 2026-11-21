<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Enums\KeyKind;
use App\Modules\Charges\Models\ChargeKey;
use App\Modules\Charges\Models\ChargeKeyShare;
use App\Modules\Charges\Models\ChargeKeyVersion;
use App\Modules\Charges\Support\KeyShares;
use App\Modules\Charges\Support\Locks;
use App\Modules\Charges\Support\Operators;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class CreateChargeKey
{
    public function __construct(
        private Locks $verrous,
        private UnitDirectory $lots,
        private KeyShares $poids,
        private Operators $operateurs,
        private RecordAudit $audit,
    ) {}

    /**
     * @param  list<array{unit_id: string, weight: int}>  $shares
     */
    public function handle(string $propertyId, string $label, KeyKind $genre, string $validFrom, array $shares): ChargeKey
    {
        return DB::transaction(function () use ($propertyId, $label, $genre, $validFrom, $shares): ChargeKey {
            $this->verrous->property($propertyId);
            $poids = $this->poids->resolve($genre, $this->lots->ofProperty($propertyId), $shares);
            $cle = ChargeKey::query()->create(['property_id' => $propertyId, 'label' => trim($label), 'kind' => $genre, 'lock_version' => 1, 'created_by_user_id' => $this->operateurs->userId()]);

            if ($genre !== KeyKind::Consumption) {
                $this->version($cle, $validFrom, $poids);
            }

            $this->audit->handle('charges.key.created', subject: $cle, metadata: ['kind' => $genre->value]);

            return $cle->load('versions.shares');
        });
    }

    /**
     * @param  array<string, int>  $poids
     */
    private function version(ChargeKey $cle, string $validFrom, array $poids): void
    {
        $version = ChargeKeyVersion::query()->create(['key_id' => $cle->id, 'valid_from' => $validFrom]);

        foreach ($poids as $lot => $valeur) {
            ChargeKeyShare::query()->create(['version_id' => $version->id, 'unit_id' => $lot, 'weight' => $valeur]);
        }
    }
}
