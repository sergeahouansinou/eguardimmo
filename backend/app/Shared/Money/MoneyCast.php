<?php

declare(strict_types=1);

namespace App\Shared\Money;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use LogicException;
use Money\Currencies\ISOCurrencies;
use Money\Currency;
use Money\Money;

/**
 * Montant en unités mineures (entier) + colonne devise ISO 4217.
 * Usage : 'loyer' => MoneyCast::class.':devise'
 *
 * @implements CastsAttributes<Money, mixed>
 */
final class MoneyCast implements CastsAttributes
{
    // Sans cela, changer la colonne devise après lecture laisse l'ancien Money en mémoire.
    public bool $withoutObjectCaching = true;

    public function __construct(private readonly string $colonneDevise = 'currency') {}

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): ?Money
    {
        if ($value === null) {
            return null;
        }

        $devise = $attributes[$this->colonneDevise] ?? null;

        if (! is_string($devise) || $devise === '') {
            throw new LogicException("Devise absente pour l'attribut monétaire [{$key}].");
        }

        $currency = $this->deviseIso($devise, $key);

        if (is_int($value)) {
            return new Money($value, $currency);
        }

        if (is_string($value) && is_numeric($value) && preg_match('/^-?\d+$/D', $value) === 1) {
            return new Money($value, $currency);
        }

        throw new LogicException("Montant non entier pour l'attribut monétaire [{$key}].");
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, string|null>
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): array
    {
        if ($value === null) {
            return [$key => null];
        }

        if (! $value instanceof Money) {
            throw new InvalidArgumentException("L'attribut [{$key}] attend une instance de Money\\Money.");
        }

        $code = $this->deviseIso($value->getCurrency()->getCode(), $key)->getCode();

        return [
            $key => $value->getAmount(),
            $this->colonneDevise => $code,
        ];
    }

    /**
     * @param  non-empty-string  $code
     */
    private function deviseIso(string $code, string $key): Currency
    {
        $currency = new Currency($code);

        if (! (new ISOCurrencies)->contains($currency)) {
            throw new LogicException("Devise [{$code}] inconnue (ISO 4217) pour l'attribut monétaire [{$key}].");
        }

        return $currency;
    }
}
