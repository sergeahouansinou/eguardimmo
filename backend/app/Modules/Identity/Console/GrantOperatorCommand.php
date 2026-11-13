<?php

declare(strict_types=1);

namespace App\Modules\Identity\Console;

use App\Modules\Identity\Actions\GrantOperator;
use App\Modules\Identity\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

final class GrantOperatorCommand extends Command
{
    protected $signature = 'identity:grant-operator {email : Adresse du compte existant}';

    protected $description = 'Attribue le rôle opérateur (console) à un compte existant';

    public function handle(GrantOperator $attribution): int
    {
        $user = User::query()->where('email', Str::lower(trim((string) $this->argument('email'))))->first();

        if ($user === null) {
            $this->error('Aucun compte ne correspond à cette adresse.');

            return self::FAILURE;
        }

        if (! $this->confirm("Attribuer le rôle opérateur à {$user->email} ?")) {
            $this->warn('Abandon : aucun changement.');

            return self::FAILURE;
        }

        $attribution->handle($user, contexte: ['via' => 'artisan', 'host' => (string) gethostname(), 'os_user' => get_current_user()]);

        $this->info('Rôle opérateur attribué. La double authentification reste obligatoire pour ouvrir la console.');

        return self::SUCCESS;
    }
}
