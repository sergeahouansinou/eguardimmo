<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Models\MandateDocument;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Vue de l'équipe, sous le contexte de son organisation : pièces du mandat, partages retirés compris.
 */
final readonly class MandateDocuments
{
    /**
     * @return CursorPaginator<int, MandateDocument>
     */
    public function page(string $mandateId, int $parPage, ?string $curseur): CursorPaginator
    {
        return MandateDocument::query()
            ->where('mandate_id', $mandateId)
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function get(string $mandateId, string $id): MandateDocument
    {
        return (Str::isUuid($id) ? MandateDocument::query()->where('mandate_id', $mandateId)->whereKey($id)->first() : null) ?? throw ErrorCode::MandateDocumentNotFound->problem();
    }
}
