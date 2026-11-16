<?php

declare(strict_types=1);

namespace App\Modules\Leases\Jurisdictions;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

final readonly class JurisdictionDataValidator
{
    /**
     * Liste blanche : un champ absent du schéma du régime est refusé, pas ignoré.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function validate(LeaseRegime $regime, array $data): array
    {
        $regles = $regime->jurisdictionDataRules();
        $messages = [];

        foreach (array_diff(array_keys($data), array_keys($regles)) as $inconnu) {
            $messages['jurisdiction_data.'.$inconnu] = ['Ce champ n\'est pas pris en charge par le régime du bail.'];
        }

        if ($messages !== []) {
            throw ValidationException::withMessages($messages);
        }

        $prefixees = [];
        foreach ($regles as $champ => $regle) {
            $prefixees['jurisdiction_data.'.$champ] = $regle;
        }

        $valide = Validator::make(['jurisdiction_data' => $data], $prefixees)->validate();

        /** @var array<string, mixed> */
        return $valide['jurisdiction_data'] ?? [];
    }
}
