<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Console;

use App\Modules\Organizations\Data\ScopedMemberData;
use App\Modules\Organizations\Queries\ScopedMembers;
use Illuminate\Console\Command;

final class ReportScopedMembersCommand extends Command
{
    protected $signature = 'organizations:report-scoped-members';

    protected $description = 'Signale les adhésions au périmètre « biens sélectionnés », non appliqué (lecture seule)';

    public function handle(ScopedMembers $adhesions): int
    {
        $lignes = $adhesions->all();

        if ($lignes === []) {
            $this->info('Aucune adhésion au périmètre « biens sélectionnés ».');

            return self::SUCCESS;
        }

        $this->warn(count($lignes).' adhésion(s) au périmètre « biens sélectionnés » : ce périmètre n\'est pas appliqué, ces membres voient tous les biens.');
        $this->table(
            ['Organisation', 'Membre', 'Rôle', 'Statut', 'Biens'],
            array_map(fn (ScopedMemberData $ligne): array => [
                $ligne->organizationId,
                $ligne->memberId,
                $ligne->role->value,
                $ligne->status->value,
                $ligne->propertyCount,
            ], $lignes),
        );

        return self::SUCCESS;
    }
}
