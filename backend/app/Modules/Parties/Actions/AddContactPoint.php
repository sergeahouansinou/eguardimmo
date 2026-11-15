<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Parties\Enums\ContactPointType;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Support\ContactPointValue;
use App\Modules\Parties\Support\PartyGuard;
use Illuminate\Support\Facades\DB;

final readonly class AddContactPoint
{
    /**
     * La première coordonnée d'un type devient principale ; demander le principal retire ce rang à l'ancien.
     */
    public function handle(Party $party, ContactPointType $type, string $value, ?string $label, bool $primary): ContactPoint
    {
        $valeur = ContactPointValue::normalize($type, $value);

        return DB::transaction(function () use ($party, $type, $valeur, $label, $primary): ContactPoint {
            $partie = Party::query()->whereKey($party->id)->lockForUpdate()->firstOrFail();

            PartyGuard::editable($partie);

            $existantes = ContactPoint::query()->where('party_id', $partie->id)->where('type', $type->value)->get();

            if ($existantes->contains('value', $valeur)) {
                throw ErrorCode::ContactPointExists->problem();
            }

            $principal = $primary || ! $existantes->contains('is_primary', true);

            if ($principal) {
                foreach ($existantes->where('is_primary', true) as $ancien) {
                    $ancien->forceFill(['is_primary' => false, 'primary_slot' => null])->save();
                }
            }

            return ContactPoint::query()->create([
                'party_id' => $partie->id,
                'type' => $type,
                'value' => $valeur,
                'label' => $label,
                'is_primary' => $principal,
                'primary_slot' => $principal ? 1 : null,
            ]);
        });
    }
}
