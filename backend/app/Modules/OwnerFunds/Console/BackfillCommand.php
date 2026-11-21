<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Console;

use App\Modules\OwnerFunds\Actions\BackfillOwnerFunds;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

final class BackfillCommand extends Command
{
    protected $signature = 'ownerfunds:backfill {organisation : identifiant de l\'organisation} {--dry-run : liste sans rien écrire (défaut)} {--apply : écrit les reclassements et active les fonds des mandants} {--force : sans confirmation}';

    protected $description = 'Rattrape les échéances émises avant l\'activation des fonds des mandants (additif, rejouable, avant la première clôture)';

    public function handle(BackfillOwnerFunds $rattrapage): int
    {
        $appliquer = (bool) $this->option('apply');

        if ($appliquer && $this->option('dry-run')) {
            $this->error('--apply et --dry-run s\'excluent.');

            return self::INVALID;
        }

        if ($appliquer && ! $this->option('force') && ! $this->confirm('Écrire les reclassements et activer les fonds des mandants pour cette organisation ?')) {
            return self::FAILURE;
        }

        try {
            $rapport = $rattrapage->handle((string) $this->argument('organisation'), $appliquer, CarbonImmutable::now());
        } catch (ApiProblem $probleme) {
            $this->error($probleme->getMessage());

            return self::FAILURE;
        }

        $this->table(['Échéance', 'Période', 'Mandat', 'Appelé', 'Encaissé', 'Imputations'], array_map(
            fn ($i): array => [$i->installmentId, $i->periodStart, $i->mandateId, $i->called, $i->collected, $i->allocations],
            $rapport->items,
        ));
        $this->line(($appliquer ? 'Reclassées : ' : 'À reclasser : ').count($rapport->items).' ; non attribuées (aucun mandat) : '.count($rapport->unmapped));

        foreach ($rapport->unmapped as $identifiant) {
            $this->warn("unmapped {$identifiant}");
        }

        $this->line($appliquer ? 'Fonds des mandants activés.' : 'Aucune écriture passée (à blanc).');

        return self::SUCCESS;
    }
}
