<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Enums\IdentifierScheme;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Models\PartyIdentifier;
use App\Modules\Parties\Support\Fingerprinter;
use App\Modules\Parties\Support\PartyGuard;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final readonly class UpdateIdentifier
{
    public function __construct(private Fingerprinter $empreintes) {}

    public function handle(PartyIdentifier $identifiant, ?string $country, ?string $value): PartyIdentifier
    {
        try {
            return DB::transaction(function () use ($identifiant, $country, $value): PartyIdentifier {
                $partie = Party::query()->whereKey($identifiant->party_id)->lockForUpdate()->firstOrFail();

                PartyGuard::editable($partie);

                $courant = PartyIdentifier::query()->findOrFail($identifiant->id);
                $valeur = $value === null ? (string) $courant->value : IdentifierScheme::normalize($value);
                $pays = $country ?? $courant->country;

                if (preg_match($courant->scheme->pattern(), $valeur) !== 1) {
                    throw ValidationException::withMessages(['value' => ['Ce numéro ne respecte pas le format attendu pour ce type d\'identifiant.']]);
                }

                $empreinte = $this->empreintes->identifier($courant->scheme, $pays, $valeur);

                $pris = PartyIdentifier::query()->where('scheme', $courant->scheme->value)->where('country', $pays)
                    ->where('value_hash', $empreinte)->whereKeyNot($courant->id)->exists();

                if ($pris) {
                    throw ErrorCode::IdentifierTaken->problem();
                }

                $courant->forceFill(['country' => $pays, 'value' => $valeur, 'value_hash' => $empreinte])->save();

                return $courant;
            });
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::IdentifierTaken->problem();
        }
    }
}
