<?php

declare(strict_types=1);

namespace App\Modules\Identity\Console;

use App\Modules\Identity\Actions\GrantOperator;
use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Identity\Models\User;
use App\Shared\Http\ApiProblem;
use Illuminate\Console\Command;
use Illuminate\Support\Str;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;

final class GrantOperatorCommand extends Command
{
    protected $signature = 'identity:grant-operator {email : Adresse du compte existant} {--role=* : Rôle opérateur (admin, support, compliance, billing, engineering), répétable}';

    protected $description = 'Attribue le rôle opérateur (console) et ses rôles à un compte existant';

    public function handle(GrantOperator $attribution, TwoFactorAuthenticationProvider $fournisseur): int
    {
        $roles = OperatorRolesOption::parse($this);

        if ($roles === null) {
            return self::FAILURE;
        }

        $user = User::query()->where('email', Str::lower(trim((string) $this->argument('email'))))->first();

        if ($user === null) {
            $this->error('Aucun compte ne correspond à cette adresse.');

            return self::FAILURE;
        }

        $liste = implode(', ', array_map(fn (OperatorRole $r): string => $r->value, $roles));

        $this->warn('La double authentification de ce compte sera remplacée et ses sessions fermées : le titulaire doit être présent.');

        if (! $this->confirm("Attribuer le rôle opérateur ({$liste}) à {$user->email} ?")) {
            $this->warn('Abandon : aucun changement.');

            return self::FAILURE;
        }

        ['secret' => $secret, 'code' => $code] = ServerTwoFactorPrompt::ask($this, $fournisseur, $user->email);

        try {
            $codes = $attribution->handle($user, $roles, $secret, $code, contexte: ['via' => 'artisan', 'host' => (string) gethostname(), 'os_user' => get_current_user()]);
        } catch (ApiProblem $probleme) {
            $this->error($probleme->getMessage());
            $this->warn('Aucun changement.');

            return self::FAILURE;
        }

        ServerTwoFactorPrompt::showRecoveryCodes($this, $codes);
        $this->info('Rôle opérateur attribué. La double authentification reste obligatoire pour ouvrir la console.');

        return self::SUCCESS;
    }
}
