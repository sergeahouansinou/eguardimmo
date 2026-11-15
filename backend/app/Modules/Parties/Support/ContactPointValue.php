<?php

declare(strict_types=1);

namespace App\Modules\Parties\Support;

use App\Modules\Parties\Enums\ContactPointType;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

final class ContactPointValue
{
    /**
     * @throws ValidationException
     */
    public static function normalize(ContactPointType $type, string $value): string
    {
        $valeur = trim($value);

        if ($type === ContactPointType::Phone) {
            $valeur = (string) preg_replace('/[\s.\-()]+/', '', $valeur);
            Validator::make(['value' => $valeur], ['value' => ['regex:/^\+?[0-9]{6,15}$/']], ['regex' => 'Ce numéro de téléphone est invalide.'])->validate();

            return $valeur;
        }

        $valeur = mb_strtolower($valeur);
        Validator::make(['value' => $valeur], ['value' => ['email:rfc', 'max:254']])->validate();

        return $valeur;
    }
}
