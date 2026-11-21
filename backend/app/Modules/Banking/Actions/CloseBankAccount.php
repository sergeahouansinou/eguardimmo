<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Banking\Enums\AccountStatus;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Banking\Support\AccountAlert;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class CloseBankAccount
{
    public function __construct(private RecordAudit $audit, private AccountAlert $alerte) {}

    public function handle(string $accountId, string $userId): OrganizationBankAccount
    {
        [$compte, $ferme] = DB::transaction(function () use ($accountId, $userId): array {
            $compte = OrganizationBankAccount::query()->lockForUpdate()->find($accountId) ?? throw ErrorCode::AccountNotFound->problem();

            if ($compte->status === AccountStatus::Closed) {
                return [$compte, false];
            }

            $compte->forceFill(['status' => AccountStatus::Closed, 'closed_at' => now(), 'closed_by_user_id' => $userId])->save();
            $this->audit->handle('banking.account.closed', subject: $compte, metadata: ['ledger_role' => $compte->ledger_role->value]);

            return [$compte, true];
        });

        if ($ferme) {
            $this->alerte->send('closed');
        }

        return $compte;
    }
}
