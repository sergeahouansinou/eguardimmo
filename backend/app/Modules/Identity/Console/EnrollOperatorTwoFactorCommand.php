<?php

declare(strict_types=1);

namespace App\Modules\Identity\Console;

use App\Modules\Identity\Actions\EnrollTwoFactorOnServer;
use App\Modules\Identity\Models\User;
use App\Shared\Http\ApiProblem;
use Illuminate\Console\Command;
use Illuminate\Support\Str;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;

final class EnrollOperatorTwoFactorCommand extends Command
{
    protected $signature = 'identity:enroll-operator-two-factor {email : Adresse du compte opérateur}';

    protected $description = 'Active ou remplace, avec le titulaire, la double authentification d\'un compte opérateur';

    public function handle(EnrollTwoFactorOnServer $enrolement, TwoFactorAuthenticationProvider $fournisseur): int
    {
        $user = User::query()->where('email', Str::lower(trim((string) $this->argument('email'))))->first();

        if ($user === null) {
            $this->error('Aucun compte ne correspond à cette adresse.');

            return self::FAILURE;
        }

        if (! $user->isActiveOperator()) {
            $this->error('Ce compte n\'est pas opérateur.');
            $this->line('Le second facteur est enregistré à l\'attribution du rôle : php artisan identity:grant-operator');

            return self::FAILURE;
        }

        if (! $this->confirm("Remplacer la double authentification de {$user->email} et fermer ses sessions ? Le titulaire doit être présent.")) {
            $this->warn('Abandon : aucun changement.');

            return self::FAILURE;
        }

        ['secret' => $secret, 'code' => $code] = ServerTwoFactorPrompt::ask($this, $fournisseur, $user->email);

        try {
            $codes = $enrolement->handle($user, $secret, $code, ['via' => 'artisan', 'host' => (string) gethostname(), 'os_user' => get_current_user()]);
        } catch (ApiProblem $probleme) {
            $this->error($probleme->getMessage());
            $this->warn('Aucun changement.');

            return self::FAILURE;
        }

        ServerTwoFactorPrompt::showRecoveryCodes($this, $codes);

        return self::SUCCESS;
    }
}
