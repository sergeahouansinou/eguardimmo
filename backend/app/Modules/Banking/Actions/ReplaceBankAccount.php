<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Banking\Data\BankAccountData;
use App\Modules\Banking\Enums\AccountStatus;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\AccountAlert;
use App\Modules\Banking\Support\AccountIdentifier;
use App\Modules\Banking\Support\Idempotency;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Money\Money;

/**
 * Un changement d'IBAN crée une ligne et ferme l'ancienne : jamais de réécriture. Le rôle de grand livre est celui de l'ancien compte.
 */
final readonly class ReplaceBankAccount
{
    public function __construct(
        private AccountIdentifier $identifiants,
        private OrganizationDirectory $organisations,
        private Idempotency $idempotence,
        private RecordAudit $audit,
        private AccountAlert $alerte,
    ) {}

    /**
     * @return array{account: OrganizationBankAccount, replayed: bool}
     */
    public function handle(string $accountId, BankAccountData $donnees, string $userId, string $cle): array
    {
        $devise = $this->organisations->currency();
        $identifiant = $this->identifiants->resolve($donnees);
        $empreinte = hash('sha256', (string) json_encode([
            'replace', $accountId, $donnees->label, $donnees->bankName, $donnees->holderName, $donnees->identifierKind->value,
            $identifiant['hash'], $donnees->reconciliationFrom->toDateString(), $donnees->openingBankBalance, $donnees->csvProfile,
        ]));

        $resultat = $this->idempotence->run($cle, $empreinte, function () use ($accountId, $donnees, $userId, $devise, $identifiant): array {
            $ancien = OrganizationBankAccount::query()->lockForUpdate()->find($accountId) ?? throw ErrorCode::AccountNotFound->problem();

            if ($ancien->status !== AccountStatus::Active) {
                throw ErrorCode::AccountClosed->problem();
            }

            $debut = CarbonImmutable::parse($donnees->reconciliationFrom->toDateString());

            if ($debut->greaterThan(CarbonImmutable::today()) || $debut->lessThan(CarbonImmutable::parse($ancien->reconciliation_from->toDateString()))) {
                throw ErrorCode::AccountStartInvalid->problem();
            }

            $ancien->forceFill(['status' => AccountStatus::Closed, 'closed_at' => now(), 'closed_by_user_id' => $userId])->save();

            try {
                $nouveau = OrganizationBankAccount::query()->create([
                    'ledger_role' => $ancien->ledger_role,
                    'label' => $donnees->label,
                    'bank_name' => $donnees->bankName,
                    'holder_name' => $donnees->holderName,
                    'identifier_kind' => $donnees->identifierKind,
                    'identifier_hash' => $identifiant['hash'],
                    'identifier_last4' => $identifiant['last4'],
                    'country' => $identifiant['country'],
                    'currency' => $devise->getCode(),
                    'status' => AccountStatus::Active,
                    'reconciliation_from' => $donnees->reconciliationFrom,
                    'opening_bank_balance' => new Money($donnees->openingBankBalance, $devise),
                    'replaces_id' => $ancien->id,
                    'csv_profile' => $donnees->csvProfile,
                    'created_by_user_id' => $userId,
                ]);
            } catch (UniqueConstraintViolationException) {
                throw ErrorCode::AccountRoleTaken->problem();
            }

            $this->audit->handle('banking.account.replaced', subject: $nouveau, metadata: ['replaces_id' => $ancien->id, 'ledger_role' => $nouveau->ledger_role->value]);

            return ['type' => 'bank_account', 'id' => $nouveau->id];
        });

        if (! $resultat['replayed']) {
            $this->alerte->send('replaced');
        }

        return ['account' => OrganizationBankAccount::query()->findOrFail($resultat['id']), 'replayed' => $resultat['replayed']];
    }
}
