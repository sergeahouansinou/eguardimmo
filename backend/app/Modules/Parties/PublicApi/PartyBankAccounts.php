<?php

declare(strict_types=1);

namespace App\Modules\Parties\PublicApi;

use App\Modules\Parties\Data\BankAccountStateData;
use App\Modules\Parties\Queries\OwnerAccesses;
use App\Modules\Parties\Support\RequestedBankAccounts;
use Carbon\CarbonImmutable;

/**
 * Écriture des comptes de paiement demandés par un mandant (ADR 0032, 4.3) : l'IBAN reste dans Parties, chiffré, et ne
 * ressort jamais. À appeler dans la transaction de l'appelant, organisation courante posée.
 */
final readonly class PartyBankAccounts
{
    public function __construct(
        private RequestedBankAccounts $comptes,
        private OwnerAccesses $acces,
    ) {}

    /**
     * L'accès propriétaire est-il encore vivant sur ce mandant (organisation courante) ?
     */
    public function isOwnerAccessLive(string $accessId, string $mandantPartyId): bool
    {
        return $this->acces->activeOfMandant($mandantPartyId, $accessId) !== null;
    }

    /**
     * Ce compte détient-il un accès propriétaire vivant sur ce mandant (organisation courante) ?
     */
    public function holdsOwnerAccess(string $mandantPartyId, string $userId): bool
    {
        return $this->acces->userHoldsActive($mandantPartyId, $userId);
    }

    public function isValidIban(#[\SensitiveParameter] string $iban): bool
    {
        return $this->comptes->isValidIban($iban);
    }

    public function countryOf(#[\SensitiveParameter] string $iban): string
    {
        return $this->comptes->countryOf($iban);
    }

    /**
     * Parties dont le compte actif porte l'un de ces IBAN (empreinte de Parties, rien n'est renvoyé que des identifiants) ; un IBAN sans partie est absent.
     *
     * @param  list<string>  $ibans
     * @return array<string, list<string>> identifiants de parties, par IBAN normalisé
     */
    public function partiesByIban(#[\SensitiveParameter] array $ibans): array
    {
        return $this->comptes->partiesByIban($ibans);
    }

    /**
     * Enregistre un compte `pending` ; null si le compte actif de la partie porte déjà cet IBAN.
     */
    public function stage(string $partyId, #[\SensitiveParameter] string $iban, ?string $bic, string $holderName, CarbonImmutable $day): ?BankAccountStateData
    {
        return $this->comptes->stage($partyId, $iban, $bic, $holderName, $day);
    }

    /**
     * L'IBAN ressaisi est celui de la demande : comparaison d'empreinte, rien n'est renvoyé.
     */
    public function matchesIban(string $bankAccountId, #[\SensitiveParameter] string $iban): bool
    {
        return $this->comptes->matchesIban($bankAccountId, $iban);
    }

    /**
     * Active le compte en attente : l'ancien compte actif est clôturé le même jour, rien n'est réécrit.
     */
    public function activate(string $bankAccountId, CarbonImmutable $day): BankAccountStateData
    {
        return $this->comptes->activate($bankAccountId, $day);
    }

    /**
     * Refuse ou abandonne un compte en attente ; sans effet sur un compte déjà tranché.
     */
    public function discard(string $bankAccountId): void
    {
        $this->comptes->discard($bankAccountId);
    }

    public function state(string $id): ?BankAccountStateData
    {
        return $this->comptes->state($id);
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, BankAccountStateData>
     */
    public function states(array $ids): array
    {
        return $this->comptes->states($ids);
    }
}
