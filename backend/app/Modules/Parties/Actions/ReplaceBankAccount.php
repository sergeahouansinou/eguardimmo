<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Parties\Data\NewBankAccountData;
use App\Modules\Parties\Enums\BankAccountStatus;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Support\AgencyBankAccountChange;
use App\Modules\Parties\Support\PartyGuard;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final readonly class ReplaceBankAccount
{
    public function __construct(
        private AddBankAccount $ajout,
        private AgencyBankAccountChange $changement,
    ) {}

    /**
     * L'ancienne ligne est clôturée à la date de début de la nouvelle (intervalle semi-ouvert) ; rien d'autre n'y est réécrit.
     */
    public function handle(BankAccount $ancien, NewBankAccountData $donnees): BankAccount
    {
        return DB::transaction(function () use ($ancien, $donnees): BankAccount {
            $partie = Party::query()->whereKey($ancien->party_id)->lockForUpdate()->firstOrFail();

            PartyGuard::editable($partie);
            $this->changement->assertAllowed($partie);

            $courant = BankAccount::query()->findOrFail($ancien->id);

            if ($courant->valid_to !== null || $courant->status !== BankAccountStatus::Active) {
                throw ErrorCode::BankAccountClosed->problem();
            }

            if ($donnees->validFrom->toDateString() < $courant->valid_from->toDateString()) {
                throw ErrorCode::BankAccountPeriodInvalid->problem();
            }

            $nouveau = $this->ajout->creer($partie, $donnees);

            $courant->valid_to = Carbon::createFromImmutable($donnees->validFrom);
            $courant->save();
            $this->changement->alert($partie);

            return $nouveau;
        });
    }
}
