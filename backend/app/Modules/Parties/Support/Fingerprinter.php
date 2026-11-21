<?php

declare(strict_types=1);

namespace App\Modules\Parties\Support;

use App\Modules\Parties\Enums\IdentifierScheme;
use App\Shared\Tenancy\CurrentOrganization;
use RuntimeException;

/**
 * Empreintes HMAC pour l'unicité et la recherche sans déchiffrer. L'organisation entre dans le calcul :
 * la même valeur donne deux empreintes dans deux organisations.
 */
final readonly class Fingerprinter
{
    public function __construct(private CurrentOrganization $organisation) {}

    public function identifier(IdentifierScheme $scheme, string $country, string $value): string
    {
        return $this->hash(['identifier', $scheme->value, $country, $value]);
    }

    public function iban(#[\SensitiveParameter] string $iban): string
    {
        return $this->hash(['iban', Iban::normalize($iban)]);
    }

    /**
     * @param  list<string>  $parties
     */
    private function hash(array $parties): string
    {
        $cle = config('parties.hmac_key');

        if (! is_string($cle) || $cle === '') {
            throw new RuntimeException('PARTIES_HMAC_KEY doit être renseignée.');
        }

        return hash_hmac('sha256', implode('|', [$this->organisation->id(), ...$parties]), $cle);
    }
}
