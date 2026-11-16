<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use App\Modules\Documents\Enums\ErrorCode;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Schéma porté par `metadata.data_schema` du type de pièce : champ => {type, required, enum, min, max}.
 * Liste blanche de règles : une règle Laravel arbitraire (`exists:`, `regex:`) n'est jamais lue dans la base.
 */
final class CertificateDataSchema
{
    private const NOM_CHAMP = '/^[a-z][a-z0-9_]{0,62}$/';

    private const TYPES = [
        'string' => ['string', 'max:500'],
        'integer' => ['integer'],
        'number' => ['numeric'],
        'boolean' => ['boolean'],
        'date' => ['date_format:Y-m-d'],
    ];

    /**
     * @param  array<array-key, mixed>  $schema
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public static function validate(array $schema, array $data): array
    {
        $regles = [];

        foreach ($schema as $champ => $definition) {
            if (! is_string($champ) || preg_match(self::NOM_CHAMP, $champ) !== 1) {
                throw ErrorCode::CertificateSchemaInvalid->problem();
            }

            $regles["values.{$champ}"] = self::rules($definition);
        }

        $inconnus = array_diff(array_keys($data), array_keys($schema));
        $validateur = Validator::make(['values' => $data], $regles);
        $validateur->after(function ($validateur) use ($inconnus): void {
            foreach ($inconnus as $champ) {
                $validateur->errors()->add("values.{$champ}", 'Ce champ n\'existe pas pour ce type de pièce.');
            }
        });

        $valide = $validateur->validate();

        return is_array($valide['values'] ?? null) ? $valide['values'] : [];
    }

    /**
     * @return list<mixed>
     */
    private static function rules(mixed $definition): array
    {
        if (! is_array($definition) || ! is_string($definition['type'] ?? null) || ! isset(self::TYPES[$definition['type']])) {
            throw ErrorCode::CertificateSchemaInvalid->problem();
        }

        $type = $definition['type'];

        $regles = [($definition['required'] ?? false) === true ? 'required' : 'nullable', ...self::TYPES[$type]];

        if (isset($definition['enum'])) {
            if (! is_array($definition['enum']) || $definition['enum'] === []) {
                throw ErrorCode::CertificateSchemaInvalid->problem();
            }

            $regles[] = Rule::in($definition['enum']);
        }

        foreach (['min', 'max'] as $borne) {
            if (isset($definition[$borne])) {
                if (! is_int($definition[$borne]) && ! is_float($definition[$borne])) {
                    throw ErrorCode::CertificateSchemaInvalid->problem();
                }

                $regles[] = $borne.':'.$definition[$borne];
            }
        }

        return $regles;
    }
}
