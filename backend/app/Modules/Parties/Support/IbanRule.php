<?php

declare(strict_types=1);

namespace App\Modules\Parties\Support;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

final class IbanRule implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! Iban::isValid($value)) {
            $fail('Cet IBAN est invalide.');
        }
    }
}
