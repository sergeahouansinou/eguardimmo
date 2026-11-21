<?php

declare(strict_types=1);

namespace App\Modules\Banking\Console;

use App\Modules\Banking\Actions\ComputeSuggestions;
use App\Modules\Banking\Queries\OrganizationsWithAccounts;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

final class SuggestCommand extends Command
{
    protected $signature = 'banking:suggest';

    protected $description = 'Recalcule les propositions de pointage de chaque organisation (rattrapage du calcul après import)';

    public function handle(OrganizationsWithAccounts $organisations, CurrentOrganization $contexte, ComputeSuggestions $calcul): int
    {
        $total = 0;
        $echecs = 0;

        foreach ($organisations->ids() as $organisation) {
            try {
                $total += $contexte->run($organisation, fn (): int => $calcul->handle());
            } catch (Throwable $erreur) {
                $echecs++;
                report($erreur);
                Log::error('Calcul des propositions bancaires en échec', ['organization_id' => $organisation, 'exception' => $erreur::class]);
            }
        }

        $this->info("{$total} proposition(s) calculée(s).");

        if ($echecs > 0) {
            $this->error("{$echecs} organisation(s) en échec.");
        }

        return $echecs === 0 ? self::SUCCESS : self::FAILURE;
    }
}
