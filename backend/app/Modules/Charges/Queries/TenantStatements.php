<?php

declare(strict_types=1);

namespace App\Modules\Charges\Queries;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\StatementStatus;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Models\ChargeStatementFile;
use App\Modules\Charges\Models\ChargeStatementLine;
use App\Modules\Charges\Models\ChargeStatementPlan;
use App\Modules\Leases\Data\TenantLeaseKeyData;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Décomptes émis (ou rectifiés) des baux visibles du locataire : jamais un brouillon, une panne ou un bail hors clé.
 */
final readonly class TenantStatements
{
    public function __construct(private TenantScope $portee) {}

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     * @return CursorPaginator<int, ChargeStatement>
     */
    public function page(array $cles, ?string $leaseId, ?string $curseur, int $parPage): CursorPaginator
    {
        return $this->visible($cles)
            ->when($leaseId !== null, fn (Builder $q) => $q->where('lease_id', (string) $leaseId))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     */
    public function get(array $cles, string $id): ChargeStatement
    {
        return (Str::isUuid($id) ? $this->visible($cles)->whereKey($id)->first() : null) ?? throw ErrorCode::StatementNotFound->problem();
    }

    /**
     * @param  Collection<int, ChargeStatement>  $decomptes
     * @return Collection<int, ChargeStatementLine>
     */
    public function lines(Collection $decomptes): Collection
    {
        return AcrossOrganizations::query(ChargeStatementLine::class)->whereIn('statement_id', $decomptes->pluck('id')->all())->orderBy('position')->get();
    }

    /**
     * Pièces publiées par l'équipe et encore dans leur période de mise à disposition.
     *
     * @param  Collection<int, ChargeStatement>  $decomptes
     * @return Collection<int, ChargeStatementFile>
     */
    public function sharedFiles(Collection $decomptes): Collection
    {
        return AcrossOrganizations::query(ChargeStatementFile::class)->whereIn('statement_id', $decomptes->pluck('id')->all())
            ->where('tenant_visible', true)
            ->where('visible_until', '>=', CarbonImmutable::today()->toDateString())
            ->orderBy('id')->get();
    }

    /**
     * @param  Collection<int, ChargeStatement>  $decomptes
     * @return list<string> décomptes étalés en douze mensualités
     */
    public function planned(Collection $decomptes): array
    {
        return array_values(array_map(strval(...), AcrossOrganizations::query(ChargeStatementPlan::class)->whereIn('statement_id', $decomptes->pluck('id')->all())->pluck('statement_id')->all()));
    }

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     * @return Builder<ChargeStatement>
     */
    private function visible(array $cles): Builder
    {
        return $this->portee->restrict(AcrossOrganizations::query(ChargeStatement::class), $cles)->whereIn('status', [StatementStatus::Issued->value, StatementStatus::Superseded->value]);
    }
}
