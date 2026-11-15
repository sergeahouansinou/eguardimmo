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

final readonly class AddIdentifier
{
    public function __construct(private Fingerprinter $empreintes) {}

    public function handle(Party $party, IdentifierScheme $scheme, string $country, string $value): PartyIdentifier
    {
        $valeur = IdentifierScheme::normalize($value);

        if (preg_match($scheme->pattern(), $valeur) !== 1) {
            throw ValidationException::withMessages(['value' => ['Ce numéro ne respecte pas le format attendu pour ce type d\'identifiant.']]);
        }

        $empreinte = $this->empreintes->identifier($scheme, $country, $valeur);

        try {
            return DB::transaction(function () use ($party, $scheme, $country, $valeur, $empreinte): PartyIdentifier {
                $partie = Party::query()->whereKey($party->id)->lockForUpdate()->firstOrFail();

                PartyGuard::editable($partie);

                if (PartyIdentifier::query()->where('scheme', $scheme->value)->where('country', $country)->where('value_hash', $empreinte)->exists()) {
                    throw ErrorCode::IdentifierTaken->problem();
                }

                return PartyIdentifier::query()->create([
                    'party_id' => $partie->id,
                    'scheme' => $scheme,
                    'country' => $country,
                    'value' => $valeur,
                    'value_hash' => $empreinte,
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::IdentifierTaken->problem();
        }
    }
}
