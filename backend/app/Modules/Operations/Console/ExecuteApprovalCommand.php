<?php

declare(strict_types=1);

namespace App\Modules\Operations\Console;

use App\Modules\Operations\Actions\ApproveApproval;
use App\Modules\Operations\Models\OperatorApproval;
use App\Shared\Http\ApiProblem;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Commande de secours d'une équipe d'un seul opérateur : l'accès au serveur tient lieu de second validateur. Jamais exposée en HTTP.
 */
final class ExecuteApprovalCommand extends Command
{
    protected $signature = 'operations:execute-approval {id : Identifiant de la demande en attente}';

    protected $description = 'Valide et exécute une demande de double validation depuis le serveur (équipe d\'un seul opérateur)';

    public function handle(ApproveApproval $validation): int
    {
        $id = strtolower(trim((string) $this->argument('id')));
        $demande = Str::isUuid($id) ? OperatorApproval::query()->with('requester')->find($id) : null;

        if ($demande === null) {
            $this->error('Aucune demande ne correspond à cet identifiant.');

            return self::FAILURE;
        }

        if (! $this->confirm("Valider et exécuter la demande {$demande->action->value} ({$demande->id}) déposée par {$demande->requester->name} ?")) {
            $this->warn('Abandon : aucun changement.');

            return self::FAILURE;
        }

        try {
            $validation->handle($demande, null, 'artisan', ['via' => 'artisan', 'host' => (string) gethostname(), 'os_user' => get_current_user()]);
        } catch (ApiProblem $probleme) {
            $this->error($probleme->getMessage());

            return self::FAILURE;
        }

        $this->info('Demande validée et exécutée.');

        return self::SUCCESS;
    }
}
