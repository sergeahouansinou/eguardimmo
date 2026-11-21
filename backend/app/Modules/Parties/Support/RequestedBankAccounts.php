<?php

declare(strict_types=1);

namespace App\Modules\Parties\Support;

use App\Modules\Parties\Data\BankAccountStateData;
use App\Modules\Parties\Enums\BankAccountStatus;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\Party;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Comptes de paiement demandés par un mandant : écriture sous verrou, dans la transaction de l'appelant.
 */
final readonly class RequestedBankAccounts
{
    public function __construct(private Fingerprinter $empreintes) {}

    public function isValidIban(#[\SensitiveParameter] string $iban): bool
    {
        return Iban::isValid($iban);
    }

    public function countryOf(#[\SensitiveParameter] string $iban): string
    {
        return substr(Iban::normalize($iban), 0, 2);
    }

    /**
     * Enregistre un compte `pending` ; null si le compte actif de la partie porte déjà cet IBAN.
     */
    public function stage(string $partyId, #[\SensitiveParameter] string $iban, ?string $bic, string $holderName, CarbonImmutable $day): ?BankAccountStateData
    {
        $partie = Party::query()->whereKey($partyId)->lockForUpdate()->firstOrFail();
        PartyGuard::editable($partie);
        $iban = Iban::normalize($iban);
        $empreinte = $this->empreintes->iban($iban);

        $identique = BankAccount::query()->where('party_id', $partyId)->whereNull('valid_to')
            ->where('status', BankAccountStatus::Active->value)->where('iban_hash', $empreinte)->exists();

        if ($identique) {
            return null;
        }

        $compte = BankAccount::query()->create([
            'party_id' => $partyId,
            'iban' => $iban,
            'iban_last4' => Iban::last4($iban),
            'iban_hash' => $empreinte,
            'bic' => $bic,
            'holder_name' => $holderName,
            'valid_from' => $day,
            'status' => BankAccountStatus::Pending,
        ]);

        return $this->toState($compte);
    }

    /**
     * Parties de l'organisation courante dont le compte actif porte l'un de ces IBAN ; un IBAN sans partie est absent du résultat.
     *
     * @param  list<string>  $ibans
     * @return array<string, list<string>> identifiants de parties, par IBAN normalisé
     */
    public function partiesByIban(#[\SensitiveParameter] array $ibans): array
    {
        $parEmpreinte = [];

        foreach ($ibans as $iban) {
            $normalise = Iban::normalize($iban);

            if (Iban::isValid($normalise)) {
                $parEmpreinte[$this->empreintes->iban($normalise)] = $normalise;
            }
        }

        $resultat = [];

        foreach (array_chunk(array_keys($parEmpreinte), 500) as $lot) {
            $comptes = BankAccount::query()->whereIn('iban_hash', $lot)->whereNull('valid_to')
                ->where('status', BankAccountStatus::Active->value)->get(['party_id', 'iban_hash']);

            foreach ($comptes as $compte) {
                $resultat[$parEmpreinte[(string) $compte->iban_hash]][] = $compte->party_id;
            }
        }

        return array_map(fn (array $parties): array => array_values(array_unique($parties)), $resultat);
    }

    /**
     * Le titulaire lu sur la pièce et l'IBAN doivent être ceux de la demande : comparaison d'empreinte, rien n'est renvoyé.
     */
    public function matchesIban(string $bankAccountId, #[\SensitiveParameter] string $iban): bool
    {
        $compte = $this->find($bankAccountId);

        return $compte !== null && is_string($compte->iban_hash) && hash_equals($compte->iban_hash, $this->empreintes->iban($iban));
    }

    /**
     * Active le compte en attente : l'ancien compte actif est clôturé le même jour, rien n'est réécrit.
     */
    public function activate(string $bankAccountId, CarbonImmutable $day): BankAccountStateData
    {
        $compte = $this->locked($bankAccountId);

        if ($compte->status !== BankAccountStatus::Pending) {
            throw ErrorCode::BankAccountClosed->problem();
        }

        $partie = Party::query()->whereKey($compte->party_id)->lockForUpdate()->firstOrFail();
        PartyGuard::editable($partie);

        foreach (BankAccount::query()->where('party_id', $compte->party_id)->whereNull('valid_to')->where('status', BankAccountStatus::Active->value)->lockForUpdate()->get() as $ancien) {
            $ancien->valid_to = Carbon::createFromImmutable($day);
            $ancien->save();
        }

        $compte->status = BankAccountStatus::Active;
        $compte->valid_from = Carbon::createFromImmutable($day);
        $compte->activated_at = Carbon::now();
        $compte->save();

        return $this->toState($compte);
    }

    /**
     * Refuse ou abandonne un compte en attente ; sans effet sur un compte déjà tranché.
     */
    public function discard(string $bankAccountId): void
    {
        $compte = $this->locked($bankAccountId);

        if ($compte->status !== BankAccountStatus::Pending) {
            return;
        }

        $compte->status = BankAccountStatus::Rejected;
        $compte->valid_to = $compte->valid_from;
        $compte->save();
    }

    public function state(string $id): ?BankAccountStateData
    {
        $compte = $this->find($id);

        return $compte === null ? null : $this->toState($compte);
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, BankAccountStateData>
     */
    public function states(array $ids): array
    {
        $resultat = [];

        foreach (BankAccount::query()->whereIn('id', $ids)->get() as $compte) {
            $resultat[$compte->id] = $this->toState($compte);
        }

        return $resultat;
    }

    private function toState(BankAccount $compte): BankAccountStateData
    {
        return new BankAccountStateData($compte->id, $compte->party_id, (string) $compte->iban_last4, (string) $compte->holder_name, $compte->status);
    }

    private function find(string $id): ?BankAccount
    {
        return Str::isUuid($id) ? BankAccount::query()->find($id) : null;
    }

    private function locked(string $id): BankAccount
    {
        return (Str::isUuid($id) ? BankAccount::query()->whereKey($id)->lockForUpdate()->first() : null) ?? throw ErrorCode::BankAccountNotFound->problem();
    }
}
