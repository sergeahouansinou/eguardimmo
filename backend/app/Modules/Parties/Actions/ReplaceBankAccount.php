<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Parties\Data\NewBankAccountData;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Support\PartyGuard;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final readonly class ReplaceBankAccount
{
    public function __construct(private AddBankAccount $ajout) {}

    /**
     * L'ancienne ligne est clôturée à la date de début de la nouvelle (intervalle semi-ouvert) ; rien d'autre n'y est réécrit.
     */
    public function handle(BankAccount $ancien, NewBankAccountData $donnees): BankAccount
    {
        return DB::transaction(function () use ($ancien, $donnees): BankAccount {
            $partie = Party::query()->whereKey($ancien->party_id)->lockForUpdate()->firstOrFail();

            PartyGuard::editable($partie);

            $courant = BankAccount::query()->findOrFail($ancien->id);

            if ($courant->valid_to !== null) {
                throw ErrorCode::BankAccountClosed->problem();
            }

            if ($donnees->validFrom->toDateString() < $courant->valid_from->toDateString()) {
                throw ErrorCode::BankAccountPeriodInvalid->problem();
            }

            $nouveau = $this->ajout->creer($partie, $donnees);

            $courant->valid_to = Carbon::createFromImmutable($donnees->validFrom);
            $courant->save();

            return $nouveau;
        });
    }
}
