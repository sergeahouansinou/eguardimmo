<?php

declare(strict_types=1);

namespace App\Modules\Identity\Console;

use App\Modules\Identity\Actions\SetOperatorRoles;
use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Identity\Models\User;
use App\Shared\Http\ApiProblem;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

final class SetOperatorRolesCommand extends Command
{
    protected $signature = 'identity:set-operator-roles {email : Adresse du compte opérateur} {--role=* : Rôle opérateur, répétable (remplace les rôles actuels)} {--force : Autorise le retrait du rôle du dernier administrateur de la console}';

    protected $description = 'Remplace les rôles d\'un opérateur actif';

    public function handle(SetOperatorRoles $roles): int
    {
        $souhaites = OperatorRolesOption::parse($this);

        if ($souhaites === null) {
            return self::FAILURE;
        }

        $user = User::query()->where('email', Str::lower(trim((string) $this->argument('email'))))->first();

        if ($user === null) {
            $this->error('Aucun compte ne correspond à cette adresse.');

            return self::FAILURE;
        }

        $liste = implode(', ', array_map(fn (OperatorRole $r): string => $r->value, $souhaites));

        if (! $this->confirm("Fixer les rôles de {$user->email} à : {$liste} ?")) {
            $this->warn('Abandon : aucun changement.');

            return self::FAILURE;
        }

        try {
            $modifie = $roles->handle($user, $souhaites, contexte: ['via' => 'artisan', 'host' => (string) gethostname(), 'os_user' => get_current_user()], garderUnAdministrateur: ! $this->option('force'));
        } catch (ApiProblem $probleme) {
            $this->error($probleme->getMessage());

            if ($probleme->problemCode === ErrorCode::TwoFactorNotEnabled->value) {
                $this->line("Activez-la d'abord avec le titulaire : php artisan identity:enroll-operator-two-factor {$user->email}");
            }

            return self::FAILURE;
        }

        if (! $modifie) {
            $this->error('Ce compte n\'est pas opérateur.');

            return self::FAILURE;
        }

        $this->info('Rôles mis à jour.');

        return self::SUCCESS;
    }
}
