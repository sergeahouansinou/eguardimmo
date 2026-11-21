<?php

declare(strict_types=1);

namespace App\Modules\Identity\Console;

use App\Modules\Identity\Actions\RevokeOperator;
use App\Modules\Identity\Models\User;
use App\Shared\Http\ApiProblem;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

final class RevokeOperatorCommand extends Command
{
    protected $signature = 'identity:revoke-operator {email : Adresse du compte opérateur} {--force : Autorise le retrait du dernier administrateur de la console}';

    protected $description = 'Retire le rôle opérateur et révoque les jetons console du compte';

    public function handle(RevokeOperator $retrait): int
    {
        $user = User::query()->where('email', Str::lower(trim((string) $this->argument('email'))))->first();

        if ($user === null) {
            $this->error('Aucun compte ne correspond à cette adresse.');

            return self::FAILURE;
        }

        if (! $this->confirm("Retirer le rôle opérateur à {$user->email} ?")) {
            $this->warn('Abandon : aucun changement.');

            return self::FAILURE;
        }

        try {
            $retire = $retrait->handle($user, contexte: ['via' => 'artisan', 'host' => (string) gethostname(), 'os_user' => get_current_user()], garderUnAdministrateur: ! $this->option('force'));
        } catch (ApiProblem $probleme) {
            $this->error($probleme->getMessage());

            return self::FAILURE;
        }

        if (! $retire) {
            $this->error('Ce compte n\'est pas opérateur.');

            return self::FAILURE;
        }

        $this->info('Rôle opérateur retiré et jetons console révoqués.');

        return self::SUCCESS;
    }
}
