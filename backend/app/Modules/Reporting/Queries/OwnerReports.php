<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries;

use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\Reporting\Enums\ReportStatus;
use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Support\DateCursor;
use App\Shared\Tenancy\AcrossOrganizations;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Comptes rendus que le mandant peut lire : publiés, ou remplacés par un rectificatif après publication (le mandant voit les deux,
 * ADR 0030). Un brouillon, un compte rendu généré ou abandonné n'existe pas pour lui. La clé est celle de `MandateDirectory::ownerScope()`.
 */
final readonly class OwnerReports
{
    public function __construct(private CurrentOrganization $contexte) {}

    /**
     * @return CursorPaginator<int, ManagementReport>
     */
    public function page(OwnerScopeData $portee, int $parPage, ?string $curseur): CursorPaginator
    {
        return $this->visible($portee)
            ->orderByDesc('period_start')
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: DateCursor::decode($curseur, 'period_start'));
    }

    /**
     * Le compte rendu avec ses lignes, lues dans le contexte de son organisation.
     */
    public function find(OwnerScopeData $portee, string $id, bool $avecLignes = false): ?ManagementReport
    {
        $rapport = Str::isUuid($id) ? $this->visible($portee)->whereKey($id)->first() : null;

        if ($rapport !== null && $avecLignes) {
            $this->contexte->run($rapport->organization_id, fn () => $rapport->load(['lines' => fn ($q) => $q->orderBy('position')]));
        }

        return $rapport;
    }

    /**
     * @return Builder<ManagementReport>
     */
    private function visible(OwnerScopeData $portee): Builder
    {
        return $portee->restrictToMandants(AcrossOrganizations::query(ManagementReport::class), 'organization_id', 'mandant_party_id')
            ->whereIn('status', [ReportStatus::Published->value, ReportStatus::Superseded->value])
            ->whereNotNull('published_at');
    }
}
