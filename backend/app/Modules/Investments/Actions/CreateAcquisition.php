<?php

declare(strict_types=1);

namespace App\Modules\Investments\Actions;

use App\Modules\Investments\Data\NewAcquisitionData;
use App\Modules\Investments\Enums\ErrorCode;
use App\Modules\Investments\Models\PropertyAcquisition;
use App\Modules\Investments\Support\Attachments;
use App\Modules\Investments\Support\Currencies;
use App\Modules\Investments\Support\Fingerprint;
use App\Modules\Investments\Support\Scopes;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class CreateAcquisition
{
    public function __construct(
        private Scopes $portees,
        private Attachments $pieces,
        private OrganizationDirectory $organisation,
        private RecordAudit $audit,
    ) {}

    /**
     * @return array{acquisition: PropertyAcquisition, replayed: bool}
     */
    public function handle(NewAcquisitionData $d): array
    {
        $empreinte = Fingerprint::of($d->content());

        return DB::transaction(function () use ($d, $empreinte): array {
            $existante = PropertyAcquisition::query()->where('idempotency_key', $d->idempotencyKey)->lockForUpdate()->first();

            if ($existante !== null) {
                return hash_equals($existante->fingerprint, $empreinte)
                    ? ['acquisition' => $existante, 'replayed' => true]
                    : throw ErrorCode::IdempotencyKeyReused->problem();
            }

            $this->portees->assert($d->propertyId, $d->unitId);
            $this->assertScope($d);

            $devise = $this->organisation->currency()->getCode();
            $acquisition = PropertyAcquisition::query()->create([
                'property_id' => $d->propertyId,
                'unit_id' => $d->unitId,
                'scope_key' => $d->unitId ?? '*',
                'acquired_on' => $d->acquiredOn,
                'currency' => $devise,
                'price' => Currencies::money($d->price, $devise),
                'acquisition_costs' => Currencies::money($d->acquisitionCosts, $devise),
                'agency_fees' => Currencies::money($d->agencyFees, $devise),
                'initial_works' => Currencies::money($d->initialWorks, $devise),
                'idempotency_key' => $d->idempotencyKey,
                'fingerprint' => $empreinte,
                'lock_version' => 1,
            ]);

            if ($d->document !== null) {
                $acquisition->forceFill(['stored_file_id' => $this->pieces->store($d->document, 'property_acquisition', $acquisition->id)])->save();
            }

            $this->audit->handle('investments.acquisition.created', subject: $acquisition);

            return ['acquisition' => $acquisition, 'replayed' => false];
        });
    }

    private function assertScope(NewAcquisitionData $d): void
    {
        $existantes = PropertyAcquisition::query()->where('property_id', $d->propertyId)->lockForUpdate()->get(['id', 'unit_id']);

        if ($existantes->contains(fn (PropertyAcquisition $a): bool => $a->unit_id === $d->unitId)) {
            throw ErrorCode::AcquisitionExists->problem('Le coût de revient de ce bien ou lot existe déjà : modifiez-le.');
        }

        if ($existantes->contains(fn (PropertyAcquisition $a): bool => ($a->unit_id === null) !== ($d->unitId === null))) {
            throw ErrorCode::AcquisitionScopeMixed->problem();
        }
    }
}
