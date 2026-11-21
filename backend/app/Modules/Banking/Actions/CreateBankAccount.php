<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Banking\Data\BankAccountData;
use App\Modules\Banking\Enums\AccountStatus;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\LedgerRole;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\AccountAlert;
use App\Modules\Banking\Support\AccountIdentifier;
use App\Modules\Banking\Support\Idempotency;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Money\Money;

final readonly class CreateBankAccount
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
    public function handle(BankAccountData $donnees, string $userId, string $cle): array
    {
        $role = $donnees->ledgerRole ?? throw ErrorCode::AccountIdentifierInvalid->problem('Le rôle du compte est obligatoire.');
        $devise = $this->organisations->currency();
        $identifiant = $this->identifiants->resolve($donnees);
        $empreinte = hash('sha256', (string) json_encode([
            'create', $role->value, $donnees->label, $donnees->bankName, $donnees->holderName, $donnees->identifierKind->value,
            $identifiant['hash'], $donnees->reconciliationFrom->toDateString(), $donnees->openingBankBalance, $donnees->csvProfile,
        ]));

        $resultat = $this->idempotence->run($cle, $empreinte, function () use ($donnees, $role, $userId, $devise, $identifiant): array {
            $existe = OrganizationBankAccount::query()->where('ledger_role', $role)->where('status', AccountStatus::Active)->exists();

            if ($existe) {
                throw ErrorCode::AccountRoleTaken->problem();
            }

            $this->assertStart($role, $donnees->reconciliationFrom);

            try {
                $compte = OrganizationBankAccount::query()->create([
                    'ledger_role' => $role,
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
                    'csv_profile' => $donnees->csvProfile,
                    'created_by_user_id' => $userId,
                ]);
            } catch (UniqueConstraintViolationException) {
                throw ErrorCode::AccountRoleTaken->problem();
            }

            $this->audit->handle('banking.account.created', subject: $compte, metadata: ['ledger_role' => $compte->ledger_role->value, 'identifier_kind' => $compte->identifier_kind->value]);

            return ['type' => 'bank_account', 'id' => $compte->id];
        });

        if (! $resultat['replayed']) {
            $this->alerte->send('created');
        }

        return ['account' => OrganizationBankAccount::query()->findOrFail($resultat['id']), 'replayed' => $resultat['replayed']];
    }

    /**
     * Pas de suivi dans le futur ; après un compte fermé du même rôle, ni avant le sien ni après la fin du mois de sa fermeture :
     * un mois sans compte suivi échapperait au blocage de la clôture.
     */
    private function assertStart(LedgerRole $role, CarbonImmutable $debut): void
    {
        $jour = CarbonImmutable::parse($debut->toDateString());
        $precedent = OrganizationBankAccount::query()->where('ledger_role', $role)->where('status', AccountStatus::Closed)->orderByDesc('closed_at')->first();

        if ($jour->greaterThan(CarbonImmutable::today())) {
            throw ErrorCode::AccountStartInvalid->problem();
        }

        if ($precedent !== null && ($jour->lessThan(CarbonImmutable::parse($precedent->reconciliation_from->toDateString())) || $jour->greaterThan(CarbonImmutable::parse((string) $precedent->closed_at)->endOfMonth()))) {
            throw ErrorCode::AccountStartInvalid->problem();
        }
    }
}
