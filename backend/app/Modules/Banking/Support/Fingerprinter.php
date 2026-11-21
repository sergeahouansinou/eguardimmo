<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Shared\Tenancy\CurrentOrganization;
use RuntimeException;
use SensitiveParameter;

/**
 * Empreintes HMAC (clé BANKING_HMAC_KEY) : l'organisation entre dans le calcul. Un IBAN ne sort jamais de la requête
 * qui le reçoit : seuls l'empreinte et les quatre derniers caractères sont gardés.
 */
final readonly class Fingerprinter
{
    public function __construct(private CurrentOrganization $organisation) {}

    public static function normalize(#[SensitiveParameter] string $identifiant): string
    {
        return strtoupper((string) preg_replace('/[\s-]+/', '', $identifiant));
    }

    public static function last4(#[SensitiveParameter] string $identifiant): string
    {
        return substr(self::normalize($identifiant), -4);
    }

    public function account(#[SensitiveParameter] string $identifiant): string
    {
        return $this->hash(['account', self::normalize($identifiant)]);
    }

    public function counterparty(#[SensitiveParameter] string $identifiant): string
    {
        return $this->hash(['counterparty', self::normalize($identifiant)]);
    }

    public function lineKey(string $accountId, string ...$parties): string
    {
        return $this->hash(['line', $accountId, ...array_values($parties)]);
    }

    public function content(string $accountId, string $sha256): string
    {
        return $this->hash(['content', $accountId, $sha256]);
    }

    /**
     * @param  list<string>  $parties
     */
    private function hash(array $parties): string
    {
        $cle = config('banking.hmac_key');

        if (! is_string($cle) || $cle === '') {
            throw new RuntimeException('BANKING_HMAC_KEY doit être renseignée.');
        }

        return hash_hmac('sha256', implode('|', [$this->organisation->id(), ...$parties]), $cle);
    }
}
