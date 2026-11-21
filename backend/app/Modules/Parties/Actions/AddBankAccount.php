<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Parties\Data\NewBankAccountData;
use App\Modules\Parties\Enums\BankAccountStatus;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\BankAccount;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Support\AgencyBankAccountChange;
use App\Modules\Parties\Support\Fingerprinter;
use App\Modules\Parties\Support\Iban;
use App\Modules\Parties\Support\PartyGuard;
use Illuminate\Support\Facades\DB;

final readonly class AddBankAccount
{
    public function __construct(
        private Fingerprinter $empreintes,
        private AgencyBankAccountChange $changement,
    ) {}

    public function handle(Party $party, NewBankAccountData $donnees): BankAccount
    {
        return DB::transaction(function () use ($party, $donnees): BankAccount {
            $partie = Party::query()->whereKey($party->id)->lockForUpdate()->firstOrFail();

            PartyGuard::editable($partie);
            $this->changement->assertAllowed($partie);
            $compte = $this->creer($partie, $donnees);
            $this->changement->alert($partie);

            return $compte;
        });
    }

    public function creer(Party $partie, NewBankAccountData $donnees): BankAccount
    {
        $iban = Iban::normalize($donnees->iban);
        $empreinte = $this->empreintes->iban($iban);

        if (BankAccount::query()->where('party_id', $partie->id)->whereNull('valid_to')->where('status', BankAccountStatus::Active->value)->where('iban_hash', $empreinte)->exists()) {
            throw ErrorCode::BankAccountExists->problem();
        }

        return BankAccount::query()->create([
            'party_id' => $partie->id,
            'iban' => $iban,
            'iban_last4' => Iban::last4($iban),
            'iban_hash' => $empreinte,
            'bic' => $donnees->bic,
            'holder_name' => $donnees->holderName,
            'valid_from' => $donnees->validFrom,
        ]);
    }
}
