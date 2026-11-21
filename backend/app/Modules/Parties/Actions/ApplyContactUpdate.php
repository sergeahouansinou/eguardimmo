<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Parties\Enums\ContactPointType;
use App\Modules\Parties\Enums\ContactUpdateStatus;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\ContactUpdateRequest;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Support\ContactPointValue;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class ApplyContactUpdate
{
    public function __construct(
        private AddContactPoint $ajout,
        private RecordAudit $audit,
    ) {}

    /**
     * Passe par l'Action d'ajout de coordonnée : la valeur devient principale. Une coordonnée déjà portée par la fiche est
     * simplement rendue principale. Les valeurs de la demande sont effacées dès la décision.
     */
    public function handle(Party $party, ContactUpdateRequest $demande, User $acteur): ContactUpdateRequest
    {
        return DB::transaction(function () use ($party, $demande, $acteur): ContactUpdateRequest {
            $verrouillee = ContactUpdateRequest::query()->whereKey($demande->id)->lockForUpdate()->firstOrFail();

            if ($verrouillee->status !== ContactUpdateStatus::Pending) {
                throw ErrorCode::ContactUpdateNotPending->problem();
            }

            foreach ([[ContactPointType::Email, $verrouillee->email], [ContactPointType::Phone, $verrouillee->phone]] as [$type, $valeur]) {
                if ($valeur !== null) {
                    $this->appliquer($party, $type, $valeur);
                }
            }

            $verrouillee->forceFill(['status' => ContactUpdateStatus::Applied, 'email' => null, 'phone' => null, 'decided_by_user_id' => $acteur->id, 'decided_at' => now()])->save();
            $this->audit->handle('parties.contact_update.applied', $acteur->id, [], $verrouillee);

            return $verrouillee;
        });
    }

    private function appliquer(Party $party, ContactPointType $type, string $valeur): void
    {
        $normalisee = ContactPointValue::normalize($type, $valeur);
        $existant = ContactPoint::query()->where('party_id', $party->id)->where('type', $type->value)->where('value', $normalisee)->first();

        if ($existant === null) {
            $this->ajout->handle($party, $type, $normalisee, null, true);

            return;
        }

        if (! $existant->is_primary) {
            ContactPoint::query()->where('party_id', $party->id)->where('type', $type->value)->where('is_primary', true)->get()
                ->each(fn (ContactPoint $ancien): bool => $ancien->forceFill(['is_primary' => false, 'primary_slot' => null])->save());
            $existant->forceFill(['is_primary' => true, 'primary_slot' => 1])->save();
        }
    }
}
