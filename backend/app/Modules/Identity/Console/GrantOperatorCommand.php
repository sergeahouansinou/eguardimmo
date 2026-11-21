<?php

declare(strict_types=1);

namespace App\Modules\Identity\Console;

use App\Modules\Identity\Actions\GrantOperator;
use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Identity\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

final class GrantOperatorCommand extends Command
{
    protected $signature = 'identity:grant-operator {email : Adresse du compte existant} {--role=* : Rôle opérateur (admin, support, compliance, billing, engineering), répétable}';

    protected $description = 'Attribue le rôle opérateur (console) et ses rôles à un compte existant';

    public function handle(GrantOperator $attribution): int
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

        if (! $this->confirm("Attribuer le rôle opérateur ({$liste}) à {$user->email} ?")) {
            $this->warn('Abandon : aucun changement.');

            return self::FAILURE;
        }

        $attribution->handle($user, $roles, contexte: ['via' => 'artisan', 'host' => (string) gethostname(), 'os_user' => get_current_user()]);

        $this->info('Rôle opérateur attribué. La double authentification reste obligatoire pour ouvrir la console.');

        return self::SUCCESS;
    }
}
