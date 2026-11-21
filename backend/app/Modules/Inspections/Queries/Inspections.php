<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Queries;

use App\Modules\Inspections\Enums\ErrorCode;
use App\Modules\Inspections\Models\Inspection;
use App\Modules\Inspections\Models\InspectionRemark;
use App\Modules\Inspections\Models\InspectionRemarkFile;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Lectures de l'équipe, dans le contexte d'organisation de la route : un identifiant d'une autre organisation n'existe pas.
 */
final readonly class Inspections
{
    /**
     * @return CursorPaginator<int, Inspection>
     */
    public function forLease(string $leaseId, int $parPage, ?string $curseur): CursorPaginator
    {
        return Inspection::query()->where('lease_id', $leaseId)->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function get(string $id): Inspection
    {
        return (Str::isUuid($id) ? Inspection::query()->find($id) : null) ?? throw ErrorCode::InspectionNotFound->problem();
    }

    /**
     * @return CursorPaginator<int, InspectionRemark>
     */
    public function remarks(Inspection $etat, int $parPage, ?string $curseur): CursorPaginator
    {
        return InspectionRemark::query()->with('files')->where('inspection_id', $etat->id)->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function remark(string $id): InspectionRemark
    {
        return (Str::isUuid($id) ? InspectionRemark::query()->with('files')->find($id) : null) ?? throw ErrorCode::InspectionRemarkNotFound->problem();
    }

    public function file(string $id): InspectionRemarkFile
    {
        return (Str::isUuid($id) ? InspectionRemarkFile::query()->find($id) : null) ?? throw ErrorCode::InspectionNotFound->problem();
    }
}
