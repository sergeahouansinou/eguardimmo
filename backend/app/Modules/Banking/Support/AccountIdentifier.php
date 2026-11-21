<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Modules\Banking\Data\BankAccountData;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\IdentifierKind;
use App\Modules\Parties\PublicApi\PartyBankAccounts;
use SensitiveParameter;

/**
 * Valide l'identifiant reçu (IBAN contrôlé modulo 97, ou numéro `other`) et n'en garde que l'empreinte et les quatre derniers caractères.
 */
final readonly class AccountIdentifier
{
    public function __construct(private PartyBankAccounts $parties, private Fingerprinter $empreintes) {}

    /**
     * @return array{hash: string, last4: string, country: string|null}
     */
    public function resolve(BankAccountData $compte): array
    {
        return $this->of($compte->identifierKind, $compte->identifier, $compte->country);
    }

    /**
     * @return array{hash: string, last4: string, country: string|null}
     */
    public function of(IdentifierKind $kind, #[SensitiveParameter] string $identifiant, ?string $country = null): array
    {
        $normalise = Fingerprinter::normalize($identifiant);

        if ($kind === IdentifierKind::Iban) {
            if (! $this->parties->isValidIban($normalise)) {
                throw ErrorCode::AccountIdentifierInvalid->problem();
            }

            $pays = $this->parties->countryOf($normalise);
        } else {
            if (preg_match('/^[A-Z0-9]{4,34}$/D', $normalise) !== 1) {
                throw ErrorCode::AccountIdentifierInvalid->problem();
            }

            $pays = $country === null ? null : strtoupper($country);
        }

        return ['hash' => $this->empreintes->account($normalise), 'last4' => Fingerprinter::last4($normalise), 'country' => $pays];
    }
}
