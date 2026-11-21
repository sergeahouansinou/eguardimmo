<?php

declare(strict_types=1);

namespace App\Modules\Banking\Actions;

use App\Modules\Banking\Enums\AccountStatus;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Models\OrganizationBankAccount;
use Illuminate\Support\Facades\DB;

/**
 * Seuls le libellé et le profil CSV se modifient ; l'identifiant, le rôle et la date de départ ne changent jamais.
 */
final readonly class UpdateBankAccount
{
    /**
     * @param  array<string, mixed>|null  $csvProfile
     */
    public function handle(string $accountId, string $label, ?array $csvProfile): OrganizationBankAccount
    {
        return DB::transaction(function () use ($accountId, $label, $csvProfile): OrganizationBankAccount {
            $compte = OrganizationBankAccount::query()->lockForUpdate()->find($accountId) ?? throw ErrorCode::AccountNotFound->problem();

            if ($compte->status !== AccountStatus::Active) {
                throw ErrorCode::AccountClosed->problem();
            }

            $compte->forceFill(['label' => $label, 'csv_profile' => $csvProfile ?? $compte->csv_profile])->save();

            return $compte;
        });
    }
}
