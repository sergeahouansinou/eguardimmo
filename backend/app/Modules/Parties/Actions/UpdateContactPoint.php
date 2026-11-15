<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Support\ContactPointValue;
use App\Modules\Parties\Support\PartyGuard;
use Illuminate\Support\Facades\DB;

final readonly class UpdateContactPoint
{
    /**
     * @param  array{value?: string, label?: string|null}  $fields
     */
    public function handle(ContactPoint $point, array $fields, bool $promote): ContactPoint
    {
        $valeur = isset($fields['value']) ? ContactPointValue::normalize($point->type, $fields['value']) : null;

        return DB::transaction(function () use ($point, $fields, $valeur, $promote): ContactPoint {
            $partie = Party::query()->whereKey($point->party_id)->lockForUpdate()->firstOrFail();

            PartyGuard::editable($partie);

            $courant = ContactPoint::query()->findOrFail($point->id);

            if ($valeur !== null && $valeur !== $courant->value) {
                $doublon = ContactPoint::query()->where('party_id', $partie->id)->where('type', $courant->type->value)
                    ->where('value', $valeur)->whereKeyNot($courant->id)->exists();

                if ($doublon) {
                    throw ErrorCode::ContactPointExists->problem();
                }

                $courant->value = $valeur;
            }

            if (array_key_exists('label', $fields)) {
                $courant->label = $fields['label'];
            }

            if ($promote && ! $courant->is_primary) {
                foreach (ContactPoint::query()->where('party_id', $partie->id)->where('type', $courant->type->value)->where('is_primary', true)->get() as $ancien) {
                    $ancien->forceFill(['is_primary' => false, 'primary_slot' => null])->save();
                }

                $courant->forceFill(['is_primary' => true, 'primary_slot' => 1]);
            }

            $courant->save();

            return $courant;
        });
    }
}
