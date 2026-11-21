<?php

declare(strict_types=1);

namespace App\Modules\Parties\Queries;

use App\Modules\Parties\Data\PayoutAccountData;
use App\Modules\Parties\Enums\BankAccountStatus;
use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\Party;
use Carbon\CarbonImmutable;

final readonly class PayoutAccounts
{
    /**
     * Compte actif ouvert le plus récent (une ligne en attente ou refusée ne compte pas) des parties données ; une partie anonymisée ou sans compte valide est absente.
     *
     * @param  list<string>  $partyIds
     * @return array<string, PayoutAccountData> par partie
     */
    public function of(array $partyIds, CarbonImmutable $jour): array
    {
        if ($partyIds === []) {
            return [];
        }

        $vivantes = Party::query()->whereIn('id', $partyIds)->whereNull('anonymized_at')->pluck('id')->all();
        $comptes = BankAccount::query()
            ->whereIn('party_id', $vivantes)
            ->where('status', BankAccountStatus::Active->value)
            ->whereNotNull('iban_last4')
            ->whereDate('valid_from', '<=', $jour->toDateString())
            ->where(fn ($q) => $q->whereNull('valid_to')->orWhere('valid_to', '>=', $jour->toDateString()))
            ->orderBy('valid_from')->orderBy('created_at')->orderBy('id')
            ->get(['id', 'party_id', 'iban_last4', 'created_at', 'activated_at']);
        $resultat = [];

        foreach ($comptes as $compte) {
            $resultat[$compte->party_id] = new PayoutAccountData($compte->id, $compte->party_id, (string) $compte->iban_last4, CarbonImmutable::instance($compte->activated_at ?? $compte->created_at ?? now()));
        }

        return $resultat;
    }
}
