<?php

declare(strict_types=1);

namespace App\Modules\Parties\Support;

use App\Modules\Parties\Enums\PartyKind;
use Illuminate\Validation\ValidationException;

/**
 * Cohérence des champs d'identité avec le type de la partie : une personne n'a pas de raison sociale, une société n'a ni prénom ni date de naissance.
 */
final class PartyShape
{
    private const PAR_TYPE = [
        'person' => ['required' => ['last_name'], 'forbidden' => ['company_name', 'legal_form_term_id']],
        'company' => ['required' => ['company_name'], 'forbidden' => ['last_name', 'first_name', 'birth_date']],
    ];

    /**
     * @param  array<string, mixed>  $attributes
     *
     * @throws ValidationException
     */
    public static function assert(PartyKind $kind, array $attributes): void
    {
        $erreurs = [];

        foreach (self::PAR_TYPE[$kind->value]['required'] as $champ) {
            if (! is_string($attributes[$champ] ?? null) || trim($attributes[$champ]) === '') {
                $erreurs[$champ] = ['Ce champ est obligatoire pour ce type de contact.'];
            }
        }

        foreach (self::PAR_TYPE[$kind->value]['forbidden'] as $champ) {
            if (($attributes[$champ] ?? null) !== null) {
                $erreurs[$champ] = ['Ce champ ne s\'applique pas à ce type de contact.'];
            }
        }

        if ($erreurs !== []) {
            throw ValidationException::withMessages($erreurs);
        }
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public static function displayName(PartyKind $kind, array $attributes): string
    {
        $nom = $kind === PartyKind::Company
            ? (string) ($attributes['company_name'] ?? '')
            : trim(($attributes['first_name'] ?? '').' '.($attributes['last_name'] ?? ''));

        return trim($nom);
    }
}
